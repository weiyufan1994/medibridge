import fs from "node:fs";
import { spawn } from "node:child_process";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const envFilePath = "/srv/medibridge/shared/.env.production";

function parseEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    env[key] = value;
  }

  return env;
}

async function getSecureParameter(client, name) {
  if (!name) {
    return "";
  }

  const result = await client.send(
    new GetParameterCommand({
      Name: name,
      WithDecryption: true,
    })
  );

  return result.Parameter?.Value ?? "";
}

async function main() {
  const fileEnv = parseEnvFile(envFilePath);
  const runtimeEnv = { ...process.env, ...fileEnv };

  const region =
    runtimeEnv.AWS_REGION || runtimeEnv.AWS_DEFAULT_REGION || "ap-southeast-1";
  const ssm = new SSMClient({ region });

  if (runtimeEnv.LLM_API_KEY_SSM_PARAMETER) {
    runtimeEnv.LLM_API_KEY = await getSecureParameter(
      ssm,
      runtimeEnv.LLM_API_KEY_SSM_PARAMETER
    );
  }

  if (runtimeEnv.DATABASE_URL_SSM_PARAMETER) {
    runtimeEnv.DATABASE_URL = await getSecureParameter(
      ssm,
      runtimeEnv.DATABASE_URL_SSM_PARAMETER
    );
  }

  if (runtimeEnv.OPENAI_API_KEY_SSM_PARAMETER) {
    runtimeEnv.OPENAI_API_KEY = await getSecureParameter(
      ssm,
      runtimeEnv.OPENAI_API_KEY_SSM_PARAMETER
    );
  }

  const child = spawn("node", ["dist/index.js"], {
    cwd: "/srv/medibridge/current",
    env: runtimeEnv,
    stdio: "inherit",
  });

  child.on("exit", code => {
    process.exit(code ?? 1);
  });
}

main().catch(error => {
  console.error("[startup] Failed to bootstrap runtime secrets", error);
  process.exit(1);
});
