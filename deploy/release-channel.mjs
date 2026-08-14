import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RELEASE_CHANNEL_FILE = ".release-channel";
const UNKNOWN_RELEASE_CHANNEL = "unknown";

function normalizeReleaseChannel(value) {
  const normalized = value.trim();
  return normalized || UNKNOWN_RELEASE_CHANNEL;
}

export function readReleaseChannel(input = {}) {
  const cwd = input.cwd ?? process.cwd();
  const readFile = input.readFile ?? readFileSync;

  try {
    return normalizeReleaseChannel(
      readFile(resolve(cwd, RELEASE_CHANNEL_FILE), "utf8")
    );
  } catch {
    return UNKNOWN_RELEASE_CHANNEL;
  }
}

export function applyReleaseChannel(runtimeEnv, releaseChannel) {
  return {
    ...runtimeEnv,
    MEDIBRIDGE_RELEASE_CHANNEL: normalizeReleaseChannel(releaseChannel),
  };
}
