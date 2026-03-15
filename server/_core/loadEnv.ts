import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function loadIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({
    path: filePath,
    override: false,
  });
}

const rootDir = process.cwd();
const mode = process.env.NODE_ENV?.trim() || "development";

loadIfExists(path.resolve(rootDir, ".env"));
loadIfExists(path.resolve(rootDir, `.env.${mode}`));
