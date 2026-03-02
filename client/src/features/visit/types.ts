export type VisitSenderType = "patient" | "doctor" | "system";

export type VisitMessageItem = {
  id: number;
  senderType: VisitSenderType;
  content: string;
  createdAt: Date;
  clientMsgId: string | null;
};
