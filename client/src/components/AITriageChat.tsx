import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { Loader2, Send, Sparkles, Stethoscope } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type TriageResult = {
  isComplete: boolean;
  reply: string;
  summary?: string;
  keywords?: string[];
};

type AITriageChatProps = {
  onSelectDoctor?: (payload: {
    doctorId: number;
    summary: string;
    keywords: string[];
  }) => void;
};

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";
const TRIAGE_SESSION_KEY = "medibridge_triage_chat_v2";

const getInitialAssistantMessage = (lang: "en" | "zh"): ChatMessage => ({
  role: "assistant",
  content:
    lang === "zh"
      ? "您好，我是分诊护士。请先描述当前最主要的不适症状，以及大概持续了多久。"
      : "Hi, I am your triage nurse. Please share your main symptoms and how long they have lasted.",
});

const TEXT = {
  en: {
    title: "AI Triage Consultation",
    subtitle:
      "The triage nurse collects key details first, then generates a summary and doctor recommendations.",
    placeholder: "Describe your symptoms, duration, and medical history...",
    typing: "AI is reviewing your triage details...",
    requestError: "Triage service is temporarily unavailable. Please try again shortly.",
    fallbackReply:
      "Sorry, the triage service is busy right now. Please try again in a moment.",
    completed: "Triage is complete. Summary and recommendations are ready.",
    summaryTitle: "Triage Summary",
    summaryDesc: "A structured summary to carry into booking/session creation.",
    summaryEmpty: "Summary will appear after triage is complete.",
    doctorTitle: "Recommended Doctors",
    doctorDesc: "Top 3-5 doctors matched by extracted keywords",
    searching: "Matching doctors...",
    noDoctor: "No doctors matched yet. Try adding more specific symptom details.",
    noBio: "No profile details available yet.",
    viewProfile: "View Profile",
    chooseBook: "Choose & Book",
    whatsapp: "Book via WhatsApp",
    startNew: "Start New Session",
    disclaimerTitle: "Medical Disclaimer",
    disclaimerDesc:
      "AI suggestions are for triage and doctor matching only. They are not a diagnosis.",
    disclaimerLine1:
      "Do not share highly sensitive identity details (ID/passport numbers) in chat.",
    disclaimerLine2:
      "If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or any emergency symptoms, call local emergency services immediately.",
    cancel: "Cancel",
    understand: "I Understand",
    rating: "Rating",
    doctorFallback: "Recommended Doctor",
  },
  zh: {
    title: "AI 预诊分诊",
    subtitle: "分诊护士先收集关键信息，再生成摘要和医生推荐。",
    placeholder: "请输入症状、持续时间、既往史等信息...",
    typing: "AI 正在整理分诊信息...",
    requestError: "分诊服务暂时不可用，请稍后重试。",
    fallbackReply: "抱歉，当前分诊服务繁忙。请稍后再试。",
    completed: "分诊已完成，摘要和推荐结果已生成。",
    summaryTitle: "病情摘要",
    summaryDesc: "可直接用于下一步预约/建会话的结构化摘要。",
    summaryEmpty: "尚未完成分诊，摘要会在完成后显示。",
    doctorTitle: "推荐医生",
    doctorDesc: "基于关键词匹配前 3-5 位医生",
    searching: "正在匹配医生...",
    noDoctor: "未检索到匹配医生，请补充更具体症状。",
    noBio: "暂无医生简介",
    viewProfile: "查看详情",
    chooseBook: "选择并预约",
    whatsapp: "WhatsApp 预约",
    startNew: "开始新会话",
    disclaimerTitle: "医疗免责声明",
    disclaimerDesc: "AI 建议仅用于分诊与医生匹配，不构成医疗诊断。",
    disclaimerLine1: "请勿在对话中发送高敏感身份信息（证件号/护照号等）。",
    disclaimerLine2: "如出现胸痛、呼吸困难、中风征象、大出血等急症，请立即联系当地急救服务。",
    cancel: "取消",
    understand: "我已知悉",
    rating: "评分",
    doctorFallback: "推荐医生",
  },
} as const;

export default function AITriageChat({ onSelectDoctor }: AITriageChatProps) {
  const { mode, resolved, reportInput } = useLanguage();
  const t = TEXT[resolved];

  const [messages, setMessages] = useState<ChatMessage[]>([
    getInitialAssistantMessage(resolved),
  ]);
  const [input, setInput] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISCLAIMER_KEY) === "1";
  });
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const chatTriageMutation = trpc.ai.chatTriage.useMutation();
  const recommendationKeywords = useMemo(
    () => (triageResult?.isComplete ? triageResult.keywords ?? [] : []),
    [triageResult]
  );

  const recommendQuery = trpc.doctors.recommend.useQuery(
    { keywords: recommendationKeywords, summary: triageResult?.summary, limit: 5 },
    {
      enabled: triageResult?.isComplete === true && recommendationKeywords.length > 0,
      retry: 1,
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(TRIAGE_SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        triageResult?: TriageResult | null;
        input?: string;
      };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      }
      if (typeof parsed.input === "string") {
        setInput(parsed.input);
      }
      if (parsed.triageResult && typeof parsed.triageResult === "object") {
        setTriageResult(parsed.triageResult);
      }
    } catch {
      // Ignore invalid session cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      TRIAGE_SESSION_KEY,
      JSON.stringify({
        messages,
        triageResult,
        input,
      })
    );
  }, [messages, triageResult, input]);

  const pushAssistantMessage = (content: string) => {
    setMessages(prev => [...prev, { role: "assistant", content }]);
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const resetSession = () => {
    setMessages([getInitialAssistantMessage(resolved)]);
    setInput("");
    setTriageResult(null);
    setRequestError(null);
    setPendingMessage(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TRIAGE_SESSION_KEY);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content || chatTriageMutation.isPending || triageResult?.isComplete) {
      return;
    }

    reportInput(content);
    setRequestError(null);

    const userMessage: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    try {
      const result = await chatTriageMutation.mutateAsync({
        messages: nextMessages,
        lang: mode,
      });

      const safeReply =
        typeof result.reply === "string" && result.reply.trim().length > 0
          ? result.reply.trim()
          : t.fallbackReply;

      pushAssistantMessage(safeReply);
      setTriageResult({
        isComplete: Boolean(result.isComplete),
        reply: safeReply,
        summary:
          typeof result.summary === "string" && result.summary.trim().length > 0
            ? result.summary.trim()
            : undefined,
        keywords: Array.isArray(result.keywords)
          ? result.keywords.filter(item => typeof item === "string" && item.trim().length > 0)
          : undefined,
      });
    } catch (error) {
      console.error("[AITriageChat] chatTriage error:", error);
      setRequestError(t.requestError);
      pushAssistantMessage(t.fallbackReply);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    if (!disclaimerAccepted) {
      setPendingMessage(content);
      setDisclaimerOpen(true);
      return;
    }

    await sendMessage(content);
  };

  const handleAcceptDisclaimer = async () => {
    setDisclaimerAccepted(true);
    setDisclaimerOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    }

    if (!pendingMessage) return;
    const content = pendingMessage;
    setPendingMessage(null);
    await sendMessage(content);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 lg:grid-cols-3">
        <Card className="self-start lg:col-span-2 border-sky-100 shadow-sm">
          <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2 text-sky-900">
              <Stethoscope className="h-5 w-5" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetSession}
                className="border-sky-300 text-sky-700 hover:bg-sky-50"
              >
                {t.startNew}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[28rem] border-b border-sky-100 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 bg-sky-100">
                        <AvatarFallback className="bg-sky-100 text-sky-700">
                          <Sparkles className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                        message.role === "user"
                          ? "bg-sky-600 text-white"
                          : "bg-sky-50 text-slate-700"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}

                {chatTriageMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.typing}
                  </div>
                )}
                <div ref={listEndRef} />
              </div>
            </ScrollArea>

            <div className="space-y-2 p-4">
              {requestError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {requestError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t.placeholder}
                  disabled={chatTriageMutation.isPending || triageResult?.isComplete}
                  className="border-sky-200 focus-visible:ring-sky-400"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || chatTriageMutation.isPending || triageResult?.isComplete}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  {chatTriageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {triageResult?.isComplete && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-emerald-700">{t.completed}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resetSession}
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    {t.startNew}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-emerald-800">{t.summaryTitle}</CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {triageResult?.isComplete ? (
                <>
                  <p className="rounded-md bg-emerald-50 px-3 py-2 leading-relaxed">
                    {triageResult.summary || t.summaryEmpty}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(triageResult.keywords ?? []).map(keyword => (
                      <span
                        key={keyword}
                        className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-slate-500">{t.summaryEmpty}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-sky-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sky-900">{t.doctorTitle}</CardTitle>
              <CardDescription>{t.doctorDesc}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[28rem] p-4">
                <div className="space-y-3">
                  {recommendQuery.isFetching && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.searching}
                    </div>
                  )}

                  {!recommendQuery.isFetching &&
                    triageResult?.isComplete &&
                    recommendQuery.data?.length === 0 && <p className="text-sm text-slate-500">{t.noDoctor}</p>}

                  {triageResult?.isComplete &&
                    (recommendQuery.data ?? []).map(item => {
                      const doctorName = getLocalizedField({
                        lang: resolved,
                        zh: item.doctor.name,
                        en: item.doctor.nameEn,
                        placeholder: t.doctorFallback,
                      });
                      const doctorTitle = getLocalizedField({
                        lang: resolved,
                        zh: item.doctor.title,
                        en: item.doctor.titleEn,
                      });
                      const departmentName = getLocalizedField({
                        lang: resolved,
                        zh: item.department.name,
                        en: item.department.nameEn,
                      });
                      const hospitalName = getLocalizedField({
                        lang: resolved,
                        zh: item.hospital.name,
                        en: item.hospital.nameEn,
                      });
                      const bio = getLocalizedField({
                        lang: resolved,
                        zh: item.doctor.expertise || item.doctor.specialty,
                        en: item.doctor.expertiseEn || item.doctor.specialtyEn,
                        placeholder: t.noBio,
                      });
                      const whatsappNumberRaw = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
                      const whatsappNumber = (whatsappNumberRaw || "").replace(/[^\d]/g, "");
                      const summary = triageResult?.summary?.trim() || "";
                      const bookingMessage =
                        resolved === "zh"
                          ? [
                              `你好，我想预约 ${doctorName} 医生。`,
                              `分诊摘要：${summary || "已在 AI 对话中提供症状描述"}`,
                              `推荐科室：${departmentName}`,
                            ].join("\n")
                          : [
                              `Hello, I would like to book an appointment with Dr. ${doctorName}.`,
                              `AI triage summary: ${summary || "Symptom details shared in AI chat."}`,
                              `Recommended department: ${departmentName}`,
                            ].join("\n");
                      const whatsappUrl = whatsappNumber
                        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(bookingMessage)}`
                        : `https://wa.me/?text=${encodeURIComponent(bookingMessage)}`;

                      return (
                        <Card key={item.doctor.id} className="border-slate-200">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={item.doctor.imageUrl ?? undefined} alt={doctorName} />
                                <AvatarFallback>{doctorName.slice(0, 1)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900">{doctorName}</p>
                                <p className="text-xs text-slate-500">{doctorTitle}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {hospitalName}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {departmentName}
                                  </Badge>
                                </div>
                                {item.doctor.recommendationScore && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    {t.rating}:{" "}
                                    <span className="font-semibold text-emerald-700">
                                      {item.doctor.recommendationScore}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">{bio}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() =>
                                  onSelectDoctor?.({
                                    doctorId: item.doctor.id,
                                    summary: triageResult?.summary || "",
                                    keywords: triageResult?.keywords ?? [],
                                  })
                                }
                              >
                                {t.chooseBook}
                              </Button>
                              <Link href={`/doctor/${item.doctor.id}`}>
                                <Button size="sm" variant="outline">
                                  {t.viewProfile}
                                </Button>
                              </Link>
                              <Button size="sm" variant="outline" asChild>
                                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                  {t.whatsapp}
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.disclaimerTitle}</DialogTitle>
            <DialogDescription>{t.disclaimerDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t.disclaimerLine1}</p>
            <p>{t.disclaimerLine2}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisclaimerOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={() => void handleAcceptDisclaimer()}>{t.understand}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
