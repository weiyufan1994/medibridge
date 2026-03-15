import "../server/_core/loadEnv";
import * as adminRepo from "../server/modules/admin/repo";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run") || args.has("-n");

  const result = await adminRepo.runRetentionCleanup({
    dryRun,
    createdBy: null,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error("[retention-cleanup] failed", error);
  process.exit(1);
});
