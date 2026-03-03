import { useState } from "react";
import { cn } from "@/lib/utils";
import type { VisitMessageItem } from "@/features/visit/types";

type VisitMessageBubbleProps = {
  message: VisitMessageItem;
  showTimestamp: boolean;
  compactWithPrev: boolean;
};

export function VisitMessageBubble({
  message,
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

  const isPatient = message.senderType === "patient";
  const wrapperClass = isPatient ? "justify-end" : "justify-start";
  const bubbleClass = isPatient
    ? "bg-sky-600 text-white"
    : "border border-slate-200 bg-white text-slate-900";
  const timestampClass = isPatient
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
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
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
              isPatient ? "text-right text-slate-500" : "text-left text-slate-500"
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
