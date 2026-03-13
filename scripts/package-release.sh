#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
ARTIFACT_DIR="${ROOT_DIR}/.artifacts"
RELEASE_DIR="${ARTIFACT_DIR}/medibridge-${TIMESTAMP}"
ARCHIVE_PATH="${ARTIFACT_DIR}/medibridge-${TIMESTAMP}.tar.gz"

mkdir -p "${RELEASE_DIR}"

cd "${ROOT_DIR}"
pnpm build

cp package.json "${RELEASE_DIR}/package.json"
cp pnpm-lock.yaml "${RELEASE_DIR}/pnpm-lock.yaml"
cp -R dist "${RELEASE_DIR}/dist"
cp -R deploy "${RELEASE_DIR}/deploy"

if [[ -d patches ]]; then
  cp -R patches "${RELEASE_DIR}/patches"
fi

COPYFILE_DISABLE=1 tar -C "${ARTIFACT_DIR}" -czf "${ARCHIVE_PATH}" "medibridge-${TIMESTAMP}"

echo "${ARCHIVE_PATH}"
