import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-production.yml", import.meta.url),
  "utf8"
);
const packageReleaseScript = readFileSync(
  new URL("../scripts/package-release.sh", import.meta.url),
  "utf8"
);

describe("production deployment runtime guard", () => {
  it("requires Node.js 24 before changing a release", () => {
    const runtimeCheck = workflow.indexOf('case "${NODE_VERSION}" in v24.*)');
    const releaseRemoval = workflow.indexOf('rm -rf "${RELEASE_DIR}"');
    const symlinkSwitch = workflow.indexOf(
      'ln -sfn "${RELEASE_DIR}" /srv/medibridge/current'
    );

    expect(runtimeCheck).toBeGreaterThan(-1);
    expect(releaseRemoval).toBeGreaterThan(runtimeCheck);
    expect(symlinkSwitch).toBeGreaterThan(runtimeCheck);
  });

  it("fails closed when Node.js is absent", () => {
    expect(workflow).toContain(
      "command -v node >/dev/null 2>&1 || { echo 'Node.js 24 is required on the production host; node was not found' >&2; exit 1; }"
    );
  });

  it("stamps the dispatched Git ref into the release artifact", () => {
    expect(workflow).toContain(
      "MEDIBRIDGE_RELEASE_CHANNEL: ${{ github.ref_name }}"
    );
    expect(packageReleaseScript).toContain(
      '"${MEDIBRIDGE_RELEASE_CHANNEL:-unknown}" > "${RELEASE_DIR}/.release-channel"'
    );
  });
});
