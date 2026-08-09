import * as repo from "./repo";

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
