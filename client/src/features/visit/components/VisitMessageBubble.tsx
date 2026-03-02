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
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
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
