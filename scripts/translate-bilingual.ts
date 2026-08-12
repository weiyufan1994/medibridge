import "../server/_core/loadEnv";
import { Pool } from "pg";
import { parseArgs } from "./translate-bilingual-core";
import {
  printRunSummary,
  type EntityRunStats,
} from "./translate-bilingual-runtime";
import {
  createTranslationDb,
  reconcileInconsistentDoneRows,
} from "./translate-bilingual-persistence";
import { translateDepartments } from "./translate-bilingual-departments";
import { translateDoctors } from "./translate-bilingual-doctors";
import { translateHospitals } from "./translate-bilingual-hospitals";

const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";

const run = async () => {
  const config = parseArgs();
  const model = config.translationModel;
  const providerName = model?.trim() || DEFAULT_TRANSLATION_PROVIDER;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  await pool.query("SET TIME ZONE 'UTC'");
  const db = createTranslationDb(pool);
  const runStats: EntityRunStats[] = [];

  try {
    if (model) {
      console.log(`[Config] Translation model override: ${model}`);
    }
    await reconcileInconsistentDoneRows(pool, config.entities);

    if (config.entities.includes("hospitals")) {
      runStats.push(await translateHospitals(db, config, model, providerName));
    }
    if (config.entities.includes("departments")) {
      runStats.push(
        await translateDepartments(db, config, model, providerName)
      );
    }
    if (config.entities.includes("doctors")) {
      runStats.push(await translateDoctors(db, config, model, providerName));
    }

    printRunSummary(runStats);

    const failedTotal = runStats.reduce(
      (total, stats) => total + stats.failed,
      0
    );
    const pendingTotal = runStats.reduce(
      (total, stats) => total + stats.pending,
      0
    );
    if (failedTotal > 0) {
      console.error(
        `\n❌ Translation finished with ${failedTotal} failed records. Check summary above for failure reasons.`
      );
      process.exitCode = 2;
    } else if (pendingTotal > 0) {
      console.warn(
        `\n⚠️ Translation finished with ${pendingTotal} pending records (incomplete English fields). Placeholder text may still appear until these records are completed.`
      );
    } else {
      console.log(
        "\n✅ Translation finished with all processed records complete."
      );
    }
  } finally {
    await pool.end();
  }
};

run().catch(error => {
  console.error("Translation worker failed:", error);
  process.exit(1);
});
