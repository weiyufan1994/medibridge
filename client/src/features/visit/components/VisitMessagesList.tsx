import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VisitMessageBubble } from "@/features/visit/components/VisitMessageBubble";
import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";
import type { ResolvedLanguage } from "@/contexts/LanguageContext";

type VisitMessagesListProps = {
  showInitialSkeleton: boolean;
  rightAlignRole: VisitParticipantRole;
  messages: VisitMessageItem[];
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadEarlierText: string;
  loadingEarlierText: string;
  resolved: ResolvedLanguage;
};

export function VisitMessagesList({
  showInitialSkeleton,
  rightAlignRole,
  messages,
  hasMoreHistory,
  isLoadingOlder,
  onLoadOlder,
  scrollContainerRef,
  loadEarlierText,
  loadingEarlierText,
  resolved,
}: VisitMessagesListProps) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto">
      <div ref={scrollContainerRef} className="h-full">
        <div data-slot="scroll-area-viewport" className="h-full overflow-y-auto">
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
            ) : messages.length === 0 ? null : (
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
                      rightAlignRole={rightAlignRole}
                      compactWithPrev={compactWithPrev}
                      showTimestamp={showTimestamp}
                      resolved={resolved}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
