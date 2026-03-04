export type VisitSenderType = "patient" | "doctor" | "system";
export type VisitParticipantRole = Exclude<VisitSenderType, "system">;

export type VisitMessageItem = {
  id: number;
  senderType: VisitSenderType;
  content: string;
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: Date;
  clientMsgId: string | null;
};
