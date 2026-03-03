import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { VisitMessageBubble } from "@/features/visit/components/VisitMessageBubble";
import type { VisitMessageItem } from "@/features/visit/types";

type VisitMessagesListProps = {
  showInitialSkeleton: boolean;
  messages: VisitMessageItem[];
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  emptyStateText: string;
};

export function VisitMessagesList({
  showInitialSkeleton,
  messages,
  hasMoreHistory,
  isLoadingOlder,
  onLoadOlder,
  scrollContainerRef,
  emptyStateText,
}: VisitMessagesListProps) {
  return (
    <section className="min-h-0 flex-1">
      <div ref={scrollContainerRef} className="h-full">
        <ScrollArea className="h-full">
          <div className="p-5">
            {hasMoreHistory ? (
              <div className="mb-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoadingOlder}
                  onClick={onLoadOlder}
                >
                  {isLoadingOlder ? "Loading..." : "Load earlier messages"}
                </Button>
              </div>
            ) : null}
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
              <div className="pt-6 text-center text-sm text-slate-500">
                {emptyStateText}
              </div>
            ) : (
              messages.map((message, index) => {
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
                    compactWithPrev={compactWithPrev}
                    showTimestamp={showTimestamp}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
