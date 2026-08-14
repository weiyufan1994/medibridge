import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyReleaseChannel,
  readReleaseChannel,
} from "../deploy/release-channel.mjs";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "medibridge-release-channel-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("deployment release channel", () => {
  it("reads and trims the channel stamped into a release", () => {
    const cwd = createTemporaryDirectory();
    writeFileSync(join(cwd, ".release-channel"), "dev\n", "utf8");

    expect(readReleaseChannel({ cwd })).toBe("dev");
  });

  it("fails closed when the release channel file is missing or empty", () => {
    const missing = createTemporaryDirectory();
    const empty = createTemporaryDirectory();
    writeFileSync(join(empty, ".release-channel"), "  \n", "utf8");

    expect(readReleaseChannel({ cwd: missing })).toBe("unknown");
    expect(readReleaseChannel({ cwd: empty })).toBe("unknown");
  });

  it("overrides a shared environment attempt to change the release channel", () => {
    expect(
      applyReleaseChannel(
        { MEDIBRIDGE_RELEASE_CHANNEL: "dev", DEMO_OTP_ENABLED: "true" },
        "main"
      )
    ).toEqual({
      MEDIBRIDGE_RELEASE_CHANNEL: "main",
      DEMO_OTP_ENABLED: "true",
    });
  });
});
