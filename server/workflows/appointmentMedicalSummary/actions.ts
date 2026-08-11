import { appointmentMedicalSummaryApi } from "../../modules/appointments/publicApi";
import { visitMedicalSummaryApi } from "../../modules/visit/publicApi";

type GenerateMedicalSummaryInput = Omit<
  Parameters<
    typeof appointmentMedicalSummaryApi.generateMedicalSummaryDraftByTokenFlow
  >[0],
  "loadRecentMessages"
>;

export function generateMedicalSummaryDraft(
  input: GenerateMedicalSummaryInput
) {
  return appointmentMedicalSummaryApi.generateMedicalSummaryDraftByTokenFlow({
    ...input,
    loadRecentMessages: visitMedicalSummaryApi.getRecentMessages,
  });
}
