/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type LocalizedText = {
  zh: string;
  en: string;
};

export type * from "../drizzle/schema";
export * from "./_core/errors";
