import { z } from "zod";

export const DEFAULT_HOSPITAL_BROWSE_LANG = "zh" as const;
export const HOSPITAL_BROWSE_LANG_VALUES = ["en", "zh"] as const;

export type HospitalBrowseLang =
  (typeof HOSPITAL_BROWSE_LANG_VALUES)[number];

export const hospitalBrowseLangSchema = z.preprocess(
  value => (value === "en" ? "en" : DEFAULT_HOSPITAL_BROWSE_LANG),
  z.enum(HOSPITAL_BROWSE_LANG_VALUES)
);
