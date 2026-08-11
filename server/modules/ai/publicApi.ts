import {
  createTriageSessionForUser,
  getTriageSessionSnapshotById,
} from "./sessionAccessActions";
import * as guestAssetRepo from "./guestAssetRepo";
import * as repo from "./repo";

export type { TriageSessionSnapshot } from "./sessionAccessActions";

export const aiTriageSessionApi = {
  createForUser: createTriageSessionForUser,
  getById: getTriageSessionSnapshotById,
};

export const aiGuestAssetApi = {
  get reassignTriageSessionsFromGuest() {
    return guestAssetRepo.reassignTriageSessionsFromGuest;
  },
};

export const aiAdminApi = {
  get getAiChatSessionById() {
    return repo.getAiChatSessionById;
  },
  get listAiChatSessionsForAdmin() {
    return repo.listAiChatSessionsForAdmin;
  },
  get listLatestKnowledgeFlagsForAdmin() {
    return repo.listLatestKnowledgeFlagsForAdmin;
  },
  get listTriageRiskEventsForAdmin() {
    return repo.listTriageRiskEventsForAdmin;
  },
};
