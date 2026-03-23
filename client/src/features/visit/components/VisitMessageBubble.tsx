import { cn } from "@/lib/utils";
import type {
  VisitMessageItem,
  VisitParticipantRole,
} from "@/features/visit/types";
import type { ResolvedLanguage } from "@/contexts/LanguageContext";
import { getVisitMessageDisplayLines } from "@/features/visit/hooks/useVisits.helpers";
import { getVisitCopy } from "@/features/visit/copy";

type VisitMessageBubbleProps = {
  message: VisitMessageItem;
  rightAlignRole: VisitParticipantRole;
  showTimestamp: boolean;
  compactWithPrev: boolean;
  resolved: ResolvedLanguage;
};

export function VisitMessageBubble({
  message,
  rightAlignRole,
  showTimestamp,
  compactWithPrev,
  resolved,
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

  const isRightMessage = message.senderType === rightAlignRole;
  const wrapperClass = isRightMessage ? "justify-end" : "justify-start";
  const primaryBubbleClass = isRightMessage
    ? "bg-teal-600 text-white"
    : "bg-slate-100 text-slate-800";
  const timestampClass = isRightMessage
    ? "text-right text-[11px] text-slate-500"
    : "text-left text-[11px] text-slate-500";
  const lines = getVisitMessageDisplayLines(message, resolved);
  const translationBadgeText = getVisitCopy(resolved).translationBadgeText;

  return (
    <div
      className={cn("flex", wrapperClass, compactWithPrev ? "mt-1" : "mt-3")}
    >
      <div className="max-w-[82%] sm:max-w-[70%]">
        <div
          className={cn(
            "relative inline-block w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isRightMessage
              ? "after:absolute after:-right-1 after:bottom-3 after:h-2.5 after:w-2.5 after:rotate-45 after:bg-teal-600 after:content-['']"
              : "after:absolute after:-left-1 after:bottom-3 after:h-2.5 after:w-2.5 after:rotate-45 after:bg-slate-100 after:content-['']",
            primaryBubbleClass
          )}
        >
          <p className="whitespace-pre-wrap break-words">{lines.primary}</p>
        </div>
        {lines.secondary ? (
          <div
            className={cn(
              "mt-1 w-fit max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700 shadow-sm",
              isRightMessage ? "ml-auto" : ""
            )}
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {lines.secondary}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{translationBadgeText}</p>
          </div>
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
