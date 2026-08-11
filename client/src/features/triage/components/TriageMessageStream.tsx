import type { ReactNode, RefObject } from "react";
import { Loader2, PanelLeftOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAssistantMessageSignature,
  getMessageContainerClass,
  type TriageDisplayMessage,
} from "./aiTriageMessagePresentation";
import { TriageTypewriterMessage } from "./TriageTypewriterMessage";

export function TriageMessageStream(props: {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  patientLabel: string;
  patientName: string;
  streamRef: RefObject<HTMLDivElement | null>;
  listEndRef: RefObject<HTMLDivElement | null>;
  isHistoryReadOnly: boolean;
  isHistoryLoading: boolean;
  messages: TriageDisplayMessage[];
  animatedAssistantSignature: string | null;
  onTypewriterProgress: () => void;
  emptyHistoryLabel: string;
  emptyLiveLabel: string;
  resultPanel: ReactNode;
  activityLabel: string | null;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
        <div className="flex items-center gap-2">
          {!props.sidebarOpen && (
            <button
              type="button"
              onClick={props.onOpenSidebar}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <p className="text-sm font-medium text-slate-900">
            {props.patientLabel}: {props.patientName}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" ref={props.streamRef}>
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex w-full flex-col space-y-8">
            {props.isHistoryReadOnly && props.isHistoryLoading ? (
              <>
                <Skeleton className="h-16 w-[75%] rounded-2xl" />
                <Skeleton className="ml-auto h-16 w-[70%] rounded-2xl" />
                <Skeleton className="h-16 w-[78%] rounded-2xl" />
              </>
            ) : props.messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                {props.isHistoryReadOnly
                  ? props.emptyHistoryLabel
                  : props.emptyLiveLabel}
              </p>
            ) : (
              props.messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={getMessageContainerClass(message.role)}>
                    <div
                      className={
                        message.role === "user"
                          ? "relative rounded-2xl bg-teal-600 p-4 text-sm leading-relaxed text-white before:absolute before:right-[-6px] before:top-3 before:h-3 before:w-3 before:rotate-45 before:bg-teal-600"
                          : "relative rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 before:absolute before:left-[-6px] before:top-3 before:h-3 before:w-3 before:rotate-45 before:border-l before:border-t before:border-slate-100 before:bg-slate-50"
                      }
                    >
                      <TriageTypewriterMessage
                        text={message.content}
                        speed={20}
                        active={
                          !props.isHistoryReadOnly &&
                          message.role === "assistant" &&
                          getAssistantMessageSignature(message, index) ===
                            props.animatedAssistantSignature
                        }
                        onProgress={props.onTypewriterProgress}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            {props.resultPanel}

            {props.activityLabel && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {props.activityLabel}
              </div>
            )}
            <div ref={props.listEndRef} />
          </div>
        </div>
      </div>
    </>
  );
}
