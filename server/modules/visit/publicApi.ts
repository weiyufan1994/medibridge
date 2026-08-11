import * as guestAssetRepo from "./guestAssetRepo";
import * as repo from "./repo";

export const visitGuestAssetApi = {
  get reassignVisitAssetsFromGuest() {
    return guestAssetRepo.reassignVisitAssetsFromGuest;
  },
};

export const visitMedicalSummaryApi = {
  get getRecentMessages() {
    return repo.getRecentMessages;
  },
};

export const visitAutomationApi = {
  get createMessage() {
    return repo.createMessage;
  },
};

export const visitAdminApi = {
  get getRecentMessages() {
    return repo.getRecentMessages;
  },
};
