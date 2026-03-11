import "dotenv/config";
import { spawnSync } from "node:child_process";

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runCommand("pnpm", ["-s", "db:sync-journal"]);
runCommand("pnpm", ["-s", "db:verify:migrations"]);
runCommand("pnpm", ["-s", "db:migrate"]);
runCommand("pnpm", ["-s", "db:verify:migrations"]);
