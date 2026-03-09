import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  VisitMessageItem,
  VisitParticipantRole,
} from "@/features/visit/types";

type VisitMessageBubbleProps = {
  message: VisitMessageItem;
  currentRole: VisitParticipantRole;
  showTimestamp: boolean;
  compactWithPrev: boolean;
};

export function VisitMessageBubble({
  message,
  currentRole,
  showTimestamp,
  compactWithPrev,
}: VisitMessageBubbleProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (message.senderType === "system") {
    return (
      <div
        className={cn("flex justify-center", compactWithPrev ? "mt-1" : "mt-3")}
      >
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {message.content}
        </span>
      </div>
    );
  }

  const isOwnMessage = message.senderType === currentRole;
  const wrapperClass = isOwnMessage ? "justify-end" : "justify-start";
  const bubbleClass = isOwnMessage
    ? "bg-teal-600 text-white"
    : "bg-slate-100 text-slate-800";
  const timestampClass = isOwnMessage
    ? "text-right text-[11px] text-slate-500"
    : "text-left text-[11px] text-slate-500";
  const canToggleOriginal =
    message.originalContent.trim().length > 0 &&
    message.originalContent !== message.translatedContent;
  const displayContent = showOriginal
    ? message.originalContent
    : message.translatedContent || message.content;

  return (
    <div
      className={cn("flex", wrapperClass, compactWithPrev ? "mt-1" : "mt-3")}
    >
      <div className="max-w-[70%]">
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isOwnMessage
              ? "after:absolute after:-right-1 after:bottom-3 after:h-2.5 after:w-2.5 after:rotate-45 after:bg-teal-600 after:content-['']"
              : "after:absolute after:-left-1 after:bottom-3 after:h-2.5 after:w-2.5 after:rotate-45 after:bg-slate-100 after:content-['']",
            bubbleClass
          )}
        >
          <p className="whitespace-pre-wrap break-words">{displayContent}</p>
        </div>
        {canToggleOriginal ? (
          <button
            type="button"
            className={cn(
              "mt-1 text-[11px] underline underline-offset-2",
              isOwnMessage ? "text-right text-slate-500" : "text-left text-slate-500"
            )}
            onClick={() => setShowOriginal(current => !current)}
          >
            {showOriginal ? "Show translation" : "Show original"}
          </button>
        ) : null}
        {showTimestamp ? (
          <p className={cn("mt-1", timestampClass)}>
            {message.createdAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
