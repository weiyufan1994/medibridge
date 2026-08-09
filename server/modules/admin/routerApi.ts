import { appointmentActionProcedures } from "./procedures/appointmentActions";
import { appointmentDetailProcedures } from "./procedures/appointmentDetail";
import { baseProcedures } from "./procedures/base";
import { batchAppointmentProcedures } from "./procedures/batchAppointments";
import { exportProcedures } from "./procedures/exports";
import { listingProcedures } from "./procedures/listing";
import { operationProcedures } from "./procedures/operations";
import { retentionProcedures } from "./procedures/retention";
import { visitSummaryProcedures } from "./procedures/visitSummaries";
import { webhookReplayProcedures } from "./procedures/webhookReplay";

export const systemProcedureMap = {
  ...baseProcedures,
  ...listingProcedures,
  ...batchAppointmentProcedures,
  ...webhookReplayProcedures,
  ...exportProcedures,
  ...operationProcedures,
  ...appointmentDetailProcedures,
  ...appointmentActionProcedures,
  ...visitSummaryProcedures,
  ...retentionProcedures,
};
