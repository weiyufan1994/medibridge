import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  formatMoneyFromMinorUnit,
} from "@/features/admin/utils/adminFormatting";
import { AppointmentsBatchControls } from "./AppointmentsBatchControls";

type TranslateFn = (zh: string, en: string) => string;

type AppointmentListItem = {
  id: number;
  email: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  doctorId: number;
  triageSessionId: number;
  createdAt: Date | string;
  hasRisk: boolean;
  riskCodes: string[];
};

type AppointmentsCardProps = {
  tr: TranslateFn;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AppointmentListItem[];
  selectedIds: number[];
  isAllVisibleSelected: boolean;
  isAnyVisibleSelected: boolean;
  onSelectAppointment: (id: number) => void;
  onToggleSelect: (id: number, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onClearSelection: () => void;
  onBatchAction: (action: {
    action: "resend_access_link" | "reinitiate_payment" | "update_status";
    toStatus?: string;
    toPaymentStatus?: string;
    reason?: string;
  }) => void;
  onPageChange: (value: number) => void;
  onRefresh: () => void;
  batchIsPending: boolean;
  batchResult?: Array<{
    appointmentId: number;
    status: "success" | "skipped" | "failed";
    reason?: string;
  }> | null;
  canBatchResendAccessLink: boolean;
  canBatchReinitiatePayment: boolean;
  canBatchUpdateStatus: boolean;
};

export function AppointmentsCard({
  tr,
  locale,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  totalPages,
  items,
  selectedIds,
  isAllVisibleSelected,
  isAnyVisibleSelected,
  onSelectAppointment,
  onToggleSelect,
  onToggleAllVisible,
  onClearSelection,
  onBatchAction,
  onPageChange,
  onRefresh,
  batchIsPending,
  batchResult,
  canBatchResendAccessLink,
  canBatchReinitiatePayment,
  canBatchUpdateStatus,
}: AppointmentsCardProps) {
  const hasItems = items.length > 0;
  const selectedCount = selectedIds.length;
  const totalPagesValue = Math.max(1, totalPages);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("预约列表", "Appointments")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AppointmentsBatchControls
          tr={tr}
          selectedCount={selectedCount}
          visibleItemCount={items.length}
          batchIsPending={batchIsPending}
          canBatchResendAccessLink={canBatchResendAccessLink}
          canBatchReinitiatePayment={canBatchReinitiatePayment}
          canBatchUpdateStatus={canBatchUpdateStatus}
          onRefresh={onRefresh}
          onClearSelection={onClearSelection}
          onBatchAction={onBatchAction}
        />

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载预约...", "Loading appointments...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : hasItems ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        ref={el => {
                          if (el) {
                            el.indeterminate =
                              isAnyVisibleSelected && !isAllVisibleSelected;
                          }
                        }}
                        onChange={event =>
                          onToggleAllVisible(event.target.checked)
                        }
                      />
                    </th>
                    <th className="px-2 py-2 text-left">ID</th>
                    <th className="px-2 py-2 text-left">
                      {tr("邮箱", "Email")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("状态", "Status")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("支付", "Payment")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("金额", "Amount")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("医生", "Doctor")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("分诊会话", "Triage Session")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("风险", "Risk")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {tr("创建时间", "Created")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-admin-surface-muted"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={event =>
                            onToggleSelect(item.id, event.target.checked)
                          }
                          onClick={event => event.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => onSelectAppointment(item.id)}
                        >
                          {item.id}
                        </button>
                      </td>
                      <td className="px-2 py-2">{item.email}</td>
                      <td className="px-2 py-2">{item.status}</td>
                      <td className="px-2 py-2">{item.paymentStatus}</td>
                      <td className="px-2 py-2">
                        {formatMoneyFromMinorUnit(
                          item.amount,
                          item.currency,
                          locale
                        )}
                      </td>
                      <td className="px-2 py-2">{item.doctorId}</td>
                      <td className="px-2 py-2">{item.triageSessionId}</td>
                      <td className="px-2 py-2">
                        {item.hasRisk ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            {item.riskCodes.length}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {formatDate(item.createdAt, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {tr(`共 ${total} 条`, `Total ${total}`)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  {tr("上一页", "Prev")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {tr("第", "Page")} {page} / {totalPagesValue}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onPageChange(Math.min(totalPagesValue, page + 1))
                  }
                  disabled={page >= totalPagesValue}
                >
                  {tr("下一页", "Next")}
                </Button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {tr("每页", "Page size")}:<span>{pageSize}</span>
                </label>
              </div>
            </div>
            {batchResult && batchResult.length > 0 ? (
              <div className="rounded border bg-admin-surface-muted p-2 text-xs">
                <p className="mb-1 font-medium">
                  {tr("最近批量操作结果", "Latest batch operation results")}
                </p>
                <div className="space-y-1">
                  {batchResult.map(item => (
                    <p key={`${item.appointmentId}-${item.status}`}>
                      {item.appointmentId} - {item.status}
                      {item.reason ? ` (${item.reason})` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {tr("暂无预约数据。", "No appointments found.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
