import { aiGuestAssetApi } from "../../modules/ai/publicApi";
import { appointmentAuthApi } from "../../modules/appointments/publicApi";
import { visitGuestAssetApi } from "../../modules/visit/publicApi";

export async function mergeGuestAssetsIntoFormalUser(input: {
  guestUserId: number;
  formalUserId: number;
}) {
  if (input.guestUserId === input.formalUserId) {
    return;
  }

  await appointmentAuthApi.reassignAppointmentsFromGuest(input);
  await visitGuestAssetApi.reassignVisitAssetsFromGuest(input);
  await aiGuestAssetApi.reassignTriageSessionsFromGuest(input);
}
