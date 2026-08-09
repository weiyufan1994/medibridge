import {
  clearSessionFlagsByType,
  recordRiskEvents,
  setSessionFlag,
} from "./events";
import { scanMessage } from "./scan";

export const triageSafetyApi = {
  clearSessionFlagsByType,
  recordRiskEvents,
  scanMessage,
  setSessionFlag,
};
