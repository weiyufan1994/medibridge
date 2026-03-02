import { Link } from "wouter";
import { Loader2, Send, Sparkles, Stethoscope } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useTriageChat } from "@/features/triage/hooks/useTriageChat";
import {
  buildTriageWhatsappMessage,
  getTriageCopy,
} from "@/features/triage/copy";
import { AppointmentModal } from "@/features/appointment/components/AppointmentModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useEffect } from "react";
import { toast } from "sonner";

type AITriageChatProps = {
  onSelectDoctor?: (payload: {
    doctorId: number;
    summary: string;
    keywords: string[];
  }) => void;
};

export default function AITriageChat({ onSelectDoctor }: AITriageChatProps) {
  const { resolved, reportInput } = useLanguage();
  const t = getTriageCopy(resolved);
  const { openLoginModal } = useAuth();
  const {
    messages,
    input,
    triageResult,
    triageSessionId,
    requestError,
    disclaimerOpen,
    quotaDialogOpen,
    quotaMessage,
    messageLimitReached,
    bookingOpen,
    bookingDoctorId,
    listEndRef,
    createSessionMutation,
    sendMessageMutation,
    recommendQuery,
    setInput,
    setBookingOpen,
    setDisclaimerOpen,
    setQuotaDialogOpen,
    resetSession,
    handleSend,
    handleAcceptDisclaimer,
    handleInputKeyDown,
    openBookingDialog,
  } = useTriageChat({
    resolved,
    reportInput,
  });
  const isChatPending =
    createSessionMutation.isPending || sendMessageMutation.isPending;

  useEffect(() => {
    if (!quotaDialogOpen) {
      return;
    }

    toast.error(quotaMessage || "游客试用额度已尽，请登录后继续问诊。");
    openLoginModal();
    setQuotaDialogOpen(false);
  }, [openLoginModal, quotaDialogOpen, quotaMessage, setQuotaDialogOpen]);

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
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}

                {isChatPending && (
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
                  disabled={isChatPending || triageResult?.isComplete || messageLimitReached}
                  className="border-sky-200 focus-visible:ring-sky-400"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={
                    !input.trim() ||
                    isChatPending ||
                    triageResult?.isComplete ||
                    messageLimitReached
                  }
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  {isChatPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {messageLimitReached && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-medium text-amber-900">
                    本次会诊已达到消息上限，请尽快预约医生继续诊疗。
                  </p>
                  <Link href="/hospitals">
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      立即预约医生
                    </Button>
                  </Link>
                </div>
              )}
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
              <CardTitle className="text-emerald-800">
                {t.summaryTitle}
              </CardTitle>
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
              {messageLimitReached && (
                <Button
                  className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                  asChild
                >
                  <Link href="/hospitals">立即预约医生</Link>
                </Button>
              )}
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
                    recommendQuery.data?.length === 0 && (
                      <p className="text-sm text-slate-500">{t.noDoctor}</p>
                    )}

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
                      const whatsappNumberRaw = import.meta.env
                        .VITE_WHATSAPP_NUMBER as string | undefined;
                      const whatsappNumber = (whatsappNumberRaw || "").replace(
                        /[^\d]/g,
                        ""
                      );
                      const summary = triageResult?.summary?.trim() || "";
                      const extraction = triageResult?.extraction;
                      const bookingCode = triageSessionId
                        .slice(-6)
                        .toUpperCase();
                      const reason =
                        typeof item.reason === "string" &&
                        item.reason.trim().length > 0
                          ? item.reason.trim()
                          : t.reasonFallback;
                      const bookingMessage = buildTriageWhatsappMessage({
                        lang: resolved,
                        doctorName,
                        summary,
                        extraction,
                        departmentName,
                        reason,
                        bookingCode,
                      });
                      const whatsappUrl = whatsappNumber
                        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(bookingMessage)}`
                        : `https://wa.me/?text=${encodeURIComponent(bookingMessage)}`;

                      return (
                        <Card key={item.doctor.id} className="border-slate-200">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage
                                  src={item.doctor.imageUrl ?? undefined}
                                  alt={doctorName}
                                />
                                <AvatarFallback>
                                  {doctorName.slice(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900">
                                  {doctorName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {doctorTitle}
                                </p>
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
                                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                  {reason}
                                </p>
                              </div>
                            </div>
                            <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                              {bio}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => {
                                  onSelectDoctor?.({
                                    doctorId: item.doctor.id,
                                    summary: triageResult?.summary || "",
                                    keywords: triageResult?.keywords ?? [],
                                  });
                                  openBookingDialog(item.doctor.id);
                                }}
                              >
                                {t.chooseBook}
                              </Button>
                              <Link href={`/doctor/${item.doctor.id}`}>
                                <Button size="sm" variant="outline">
                                  {t.viewProfile}
                                </Button>
                              </Link>
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
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
            <Button onClick={() => void handleAcceptDisclaimer()}>
              {t.understand}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        doctorId={bookingDoctorId}
        sessionId={triageSessionId || "triage-session"}
        resolved={resolved}
      />
    </>
  );
}
