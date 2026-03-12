export type TriageDisplayRole = "user" | "assistant";

export type TriageDisplayMessage = {
  role: TriageDisplayRole;
  content: string;
};

export const getMessageContainerClass = (role: TriageDisplayRole): string =>
  role === "user"
    ? "w-fit max-w-[90%] md:max-w-[80%] self-end"
    : "w-fit max-w-[90%] md:max-w-[80%] self-start";

export const getTriageResultContainerClass = (): string => "flex justify-center";

export const getAssistantMessageSignature = (
  message: TriageDisplayMessage,
  index: number
): string => `${index}:${message.role}:${message.content}`;

export const resolveAnimatedAssistantSignature = (params: {
  previousMessages: TriageDisplayMessage[] | null;
  nextMessages: TriageDisplayMessage[];
  isHistoryReadOnly: boolean;
}): string | null => {
  const { previousMessages, nextMessages, isHistoryReadOnly } = params;
  if (isHistoryReadOnly || !previousMessages) {
    return null;
  }

  if (nextMessages.length !== previousMessages.length + 1) {
    return null;
  }

  const previousLastMessage = previousMessages[previousMessages.length - 1];
  const nextLastMessage = nextMessages[nextMessages.length - 1];
  if (!nextLastMessage || nextLastMessage.role !== "assistant") {
    return null;
  }

  if (!previousLastMessage || previousLastMessage.role !== "user") {
    return null;
  }

  return getAssistantMessageSignature(nextLastMessage, nextMessages.length - 1);
};
