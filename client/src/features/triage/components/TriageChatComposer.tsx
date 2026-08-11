import type { KeyboardEventHandler } from "react";
import { Link } from "wouter";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisclaimerNotice } from "@/components/disclaimer/DisclaimerDialog";

export function TriageChatComposer(props: {
  input: string;
  inputPlaceholder: string;
  requestError: string | null;
  isInputDisabled: boolean;
  isChatPending: boolean;
  showReferralNextStepGuidance: boolean;
  messageLimitReached: boolean;
  primaryReferralEntryHref: string;
  onInputChange: (value: string) => void;
  onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void | Promise<void>;
  labels: {
    postCompleteTitle: string;
    postCompleteDescription: string;
    disclaimer: string;
    messageLimitReached: string;
    messageLimitAction: string;
  };
}) {
  return (
    <div className="mt-auto px-4">
      {props.requestError && (
        <p className="mx-auto mb-3 w-full max-w-3xl rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {props.requestError}
        </p>
      )}

      <div className="mx-auto mb-6 w-full max-w-3xl">
        {props.showReferralNextStepGuidance ? (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              {props.labels.postCompleteTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {props.labels.postCompleteDescription}
            </p>
          </div>
        ) : null}
        <div
          className={`relative flex items-end overflow-hidden rounded-3xl border transition-colors ${
            props.showReferralNextStepGuidance
              ? "cursor-not-allowed border-slate-200 bg-slate-50/90 shadow-sm"
              : props.isInputDisabled
                ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-80 shadow-sm"
                : "border-slate-200 bg-white shadow-md focus-within:border-teal-500"
          }`}
        >
          <Textarea
            value={props.input}
            onChange={event => props.onInputChange(event.target.value)}
            onKeyDown={props.onInputKeyDown}
            placeholder={props.inputPlaceholder}
            disabled={props.isInputDisabled}
            className={`w-full resize-none border-0 bg-transparent py-4 pl-5 pr-16 outline-none focus-visible:ring-0 ${
              props.showReferralNextStepGuidance
                ? "max-h-24 min-h-[56px] text-slate-500"
                : "max-h-32 min-h-[64px] text-slate-800"
            }`}
          />
          <button
            type="button"
            onClick={() => void props.onSend()}
            disabled={
              props.isInputDisabled ||
              !props.input.trim() ||
              props.isChatPending
            }
            className={`absolute bottom-3 right-3 rounded-xl p-2 text-white transition-colors ${
              props.isInputDisabled || props.isChatPending
                ? "cursor-not-allowed bg-slate-300 text-slate-300"
                : "bg-teal-600 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <DisclaimerNotice
          text={props.labels.disclaimer}
          className="mx-4 mt-3"
        />
      </div>

      {props.messageLimitReached && (
        <div className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-900">
            {props.labels.messageLimitReached}
          </p>
          <Link href={props.primaryReferralEntryHref}>
            <Button className="bg-teal-600 hover:bg-teal-700">
              {props.labels.messageLimitAction}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
