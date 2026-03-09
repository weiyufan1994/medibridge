import type { RefObject } from "react";

export type VisitSenderType = "patient" | "doctor" | "system";
export type VisitParticipantRole = Exclude<VisitSenderType, "system">;

export type VisitMessageItem = {
  id: number;
  senderType: VisitSenderType;
  content: string;
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: Date;
  clientMessageId: string | null;
};

export type VisitSharedViewProps = {
  doctorName: string;
  departmentName: string;
  doctorTitleDisplay: string;
  consultationLiveText: string;
  localTimeLabel: string;
  localNowText: string;
  beijingTimeLabel: string;
  chinaNowText: string;
  isReconnecting: boolean;
  reconnectingText: string;
  effectiveCanSendMessage: boolean;
  readOnlyText: string;
  pollingFatalError: string | null;
  showInitialSkeleton: boolean;
  messages: VisitMessageItem[];
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadEarlierText: string;
  loadingEarlierText: string;
  content: string;
  onChangeContent: (value: string) => void;
  onSend: () => void;
  composerDisabled: boolean;
  isSending: boolean;
  composerPlaceholder: string;
  composerHint: string;
  onSelectAttachment: (file: File) => void;
};
