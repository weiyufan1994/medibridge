import * as baseAiActions from "./actions";
import * as aiConsultationActions from "./consultationActions";
import * as aiConsultationSchemas from "./consultationSchemas";
import * as baseAiSchemas from "./schemas";

export const aiActions = {
  ...baseAiActions,
  ...aiConsultationActions,
};

export const aiSchemas = {
  ...baseAiSchemas,
  ...aiConsultationSchemas,
};
