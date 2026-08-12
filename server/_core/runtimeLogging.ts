import { createLogger } from "./logger";

const logger = createLogger("server-runtime");

export function logPortFallback(preferredPort: number, port: number) {
  logger.warn("port_fallback", { preferredPort, port });
}

export function logServerStarted(port: number) {
  logger.info("server_started", { port });
}

export function logServerStartFailed(error: unknown) {
  logger.error("server_start_failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

export function logBuildDirectoryMissing() {
  logger.error("build_directory_missing");
}
