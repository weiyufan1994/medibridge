import type { TriageDisplayMessage } from "./aiTriageMessagePresentation";
import type { TriageHistoryItem } from "./TriageHistorySidebar";

export function buildCurrentSessionSidebarTitle(input: {
  messages: TriageDisplayMessage[];
  triageResult: { summary?: string } | null;
  fallbackTitle: string;
}) {
  const summaryTitle = input.triageResult?.summary?.trim();
  if (summaryTitle) {
    return summaryTitle.slice(0, 255);
  }

  const firstUserMessage = input.messages
    .find(message => message.role === "user")
    ?.content?.trim();
  if (firstUserMessage) {
    return firstUserMessage.replace(/\s+/g, " ").slice(0, 255);
  }

  return input.fallbackTitle;
}

export function buildTriageHistoryItems(
  sessions: Array<{
    id: number;
    title: string;
    status: "active" | "completed";
    createdAt: Date | string;
  }>,
  now = new Date()
): TriageHistoryItem[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgoStart = new Date(todayStart);
  sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7);

  return sessions.map(session => {
    const createdAt = new Date(session.createdAt);
    let group: TriageHistoryItem["group"] = "older";
    if (!Number.isNaN(createdAt.getTime())) {
      if (createdAt >= todayStart) {
        group = "today";
      } else if (createdAt >= sevenDaysAgoStart) {
        group = "previous7";
      }
    }
    return {
      id: session.id,
      title: session.title,
      status: session.status,
      group,
    };
  });
}

export function mergeCurrentTriageHistoryItem(
  todayItems: TriageHistoryItem[],
  currentSession: TriageHistoryItem | null
) {
  if (!currentSession) {
    return todayItems;
  }
  return [
    currentSession,
    ...todayItems.filter(item => item.id !== currentSession.id),
  ];
}
