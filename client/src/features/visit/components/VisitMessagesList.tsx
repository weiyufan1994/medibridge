import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { VisitMessageBubble } from "@/features/visit/components/VisitMessageBubble";
import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";

type VisitMessagesListProps = {
  showInitialSkeleton: boolean;
  currentRole: VisitParticipantRole;
  messages: VisitMessageItem[];
  summaryTitle: string;
  summaryText: string;
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  emptyStateText: string;
  loadEarlierText: string;
  loadingEarlierText: string;
};

export function VisitMessagesList({
  showInitialSkeleton,
  currentRole,
  messages,
  summaryTitle,
  summaryText,
  hasMoreHistory,
  isLoadingOlder,
  onLoadOlder,
  scrollContainerRef,
  emptyStateText,
  loadEarlierText,
  loadingEarlierText,
}: VisitMessagesListProps) {
  return (
    <section className="min-h-0 flex-1">
      <div ref={scrollContainerRef} className="h-full">
        <ScrollArea className="h-full">
          <div className="p-5">
            {hasMoreHistory ? (
              <div className="mb-3 flex justify-center">
                {isLoadingOlder ? (
                  <p className="text-xs text-slate-500">{loadingEarlierText}</p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onLoadOlder}
                  >
                    {loadEarlierText}
                  </Button>
                )}
              </div>
            ) : null}
            <div className="mb-4 rounded-2xl bg-blue-50/50 px-4 py-3">
              <p className="text-xs font-medium text-blue-900">{summaryTitle}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {summaryText}
              </p>
            </div>
            {showInitialSkeleton ? (
              <div className="space-y-3">
                <div className="flex justify-start">
                  <Skeleton className="h-14 w-[68%] rounded-2xl" />
                </div>
                <div className="flex justify-start">
                  <Skeleton className="h-12 w-[54%] rounded-2xl" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-12 w-[60%] rounded-2xl" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-10 w-[45%] rounded-2xl" />
                </div>
                <div className="flex justify-start">
                  <Skeleton className="h-12 w-[63%] rounded-2xl" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-6 w-40 rounded-full" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="relative flex h-[38vh] items-center justify-center">
                <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-slate-100 to-transparent" />
                <p className="relative bg-white px-3 text-sm text-slate-400">
                  {emptyStateText}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const next = messages[index + 1];
                  const compactWithPrev = Boolean(
                    previous && previous.senderType === message.senderType
                  );
                  const showTimestamp = !next || next.senderType !== message.senderType;

                  return (
                    <VisitMessageBubble
                      key={message.id}
                      message={message}
                      currentRole={currentRole}
                      compactWithPrev={compactWithPrev}
                      showTimestamp={showTimestamp}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
