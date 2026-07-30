import type { ComponentType, ReactNode } from "react";
import {
  CalendarClock,
  CircleDollarSign,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import {
  formatBookingAmount,
  formatBookingDate,
  getBookingPaymentPillClass,
  getBookingStatusDotClass,
} from "@/features/booking/presentation";
import type {
  BookingDetailMeta,
  BookingStickyAction,
  BookingWorkspaceLang,
} from "@/features/booking/types";
import { cn } from "@/lib/utils";

type BookingDetailPanelProps = {
  lang: BookingWorkspaceLang;
  locale: string;
  detailMeta: BookingDetailMeta;
  isLoading: boolean;
  errorMessage?: string;
  detailContent?: ReactNode;
  stickyActions: BookingStickyAction[];
};

export function BookingDetailPanel({
  lang,
  locale,
  detailMeta,
  isLoading,
  errorMessage,
  detailContent,
  stickyActions,
}: BookingDetailPanelProps) {
  const copy = getBookingWorkspaceCopy(lang);
  const hasSelection = detailMeta.id !== null;

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  getBookingStatusDotClass(detailMeta.status ?? "")
                )}
              />
              <h2 className="truncate text-sm font-semibold text-slate-900">
                {copy.detail.title}
                {hasSelection ? ` #${detailMeta.id}` : ""}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {detailMeta.email ?? copy.detail.empty}
            </p>
          </div>

          {hasSelection ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 text-slate-700"
              >
                {detailMeta.status ?? "-"}
              </Badge>
              <Badge
                variant="outline"
                className={getBookingPaymentPillClass(
                  detailMeta.paymentStatus ?? ""
                )}
              >
                {detailMeta.paymentStatus ?? "-"}
              </Badge>
              {detailMeta.riskFlag ? (
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50 text-rose-700"
                >
                  {copy.status.riskOnly}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasSelection ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <DetailStat
              icon={Mail}
              label={copy.detail.metaEmail}
              value={detailMeta.email ?? "-"}
            />
            <DetailStat
              icon={CalendarClock}
              label={copy.detail.metaTime}
              value={formatBookingDate(detailMeta.scheduledAt, locale)}
            />
            <DetailStat
              icon={CircleDollarSign}
              label={copy.detail.metaAmount}
              value={formatBookingAmount(
                detailMeta.amount,
                detailMeta.currency,
                locale
              )}
            />
            <DetailStat
              icon={ShieldAlert}
              label={copy.detail.metaPayment}
              value={detailMeta.paymentStatus ?? "-"}
            />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        {!hasSelection ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {copy.detail.empty}
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center px-8 text-sm text-muted-foreground">
            {copy.detail.loading}
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center px-8 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4 px-5 py-4 pb-8">{detailContent}</div>
          </ScrollArea>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-10px_28px_-22px_rgba(15,23,42,0.55)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {copy.detail.footerHint}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {stickyActions.map(action => (
              <Button
                key={action.kind}
                type="button"
                size="sm"
                variant={
                  action.kind === "reinitiate_payment"
                    ? "destructive"
                    : "outline"
                }
                disabled={action.disabled}
                title={action.title}
                onClick={action.onClick}
              >
                {getStickyActionLabel(copy, action)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

function getStickyActionLabel(
  copy: ReturnType<typeof getBookingWorkspaceCopy>,
  action: BookingStickyAction
) {
  if (action.kind === "generate_summary_en") {
    return action.pending
      ? copy.footer.generateSummaryEnPending
      : copy.footer.generateSummaryEn;
  }
  if (action.kind === "resend_link") {
    return action.pending
      ? copy.footer.resendLinkPending
      : copy.footer.resendLink;
  }
  return action.pending
    ? copy.footer.reinitiatePaymentPending
    : copy.footer.reinitiatePayment;
}
