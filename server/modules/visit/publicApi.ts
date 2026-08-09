import * as repo from "./repo";

export const visitAdminApi = {
  get getRecentMessages() {
    return repo.getRecentMessages;
  },
};
