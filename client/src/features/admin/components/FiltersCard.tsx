import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TranslateFn = (zh: string, en: string) => string;

type FiltersCardProps = {
  tr: TranslateFn;
  emailQuery: string;
  onEmailQueryChange: (value: string) => void;
  appointmentIdInput: string;
  onAppointmentIdInputChange: (value: string) => void;
  onOpenAppointmentById: () => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  paymentStatusFilter: string;
  onPaymentStatusFilterChange: (value: string) => void;
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  doctorIdInput: string;
  onDoctorIdInputChange: (value: string) => void;
  amountMinInput: string;
  onAmountMinChange: (value: string) => void;
  amountMaxInput: string;
  onAmountMaxChange: (value: string) => void;
  createdAtFrom: string;
  onCreatedAtFromChange: (value: string) => void;
  createdAtTo: string;
  onCreatedAtToChange: (value: string) => void;
  scheduledAtFrom: string;
  onScheduledAtFromChange: (value: string) => void;
  scheduledAtTo: string;
  onScheduledAtToChange: (value: string) => void;
  hasRiskFilter: boolean;
  onHasRiskFilterChange: (value: boolean) => void;
  sortBy:
    | "createdAt"
    | "scheduledAt"
    | "amount"
    | "status"
    | "paymentStatus"
    | "id";
  onSortByChange: (
    value: "createdAt" | "scheduledAt" | "amount" | "status" | "paymentStatus" | "id"
  ) => void;
  sortDirection: "asc" | "desc";
  onSortDirectionChange: (value: "asc" | "desc") => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (value: number) => void;
  onRefresh: () => void;
};

export function FiltersCard({
  tr,
  emailQuery,
  onEmailQueryChange,
  appointmentIdInput,
  onAppointmentIdInputChange,
  onOpenAppointmentById,
  statusFilter,
  onStatusFilterChange,
  paymentStatusFilter,
  onPaymentStatusFilterChange,
  appointmentStatusOptions,
  paymentStatusOptions,
  doctorIdInput,
  onDoctorIdInputChange,
  amountMinInput,
  onAmountMinChange,
  amountMaxInput,
  onAmountMaxChange,
  createdAtFrom,
  onCreatedAtFromChange,
  createdAtTo,
  onCreatedAtToChange,
  scheduledAtFrom,
  onScheduledAtFromChange,
  scheduledAtTo,
  onScheduledAtToChange,
  hasRiskFilter,
  onHasRiskFilterChange,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPageChange,
  onRefresh,
}: FiltersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("筛选", "Filters")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm space-y-1">
            <p className="text-xs text-muted-foreground">{tr("按邮箱搜索", "Search by email")}</p>
            <Input
              value={emailQuery}
              onChange={event => onEmailQueryChange(event.target.value)}
              placeholder="patient@example.com"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("按 ID 打开预约", "Open appointment by ID")}</p>
            <div className="flex items-center gap-2">
              <Input
                value={appointmentIdInput}
                onChange={event => onAppointmentIdInputChange(event.target.value)}
                placeholder={tr("例如：123", "e.g. 123")}
              />
              <Button type="button" variant="outline" onClick={onOpenAppointmentById}>
                {tr("打开", "Open")}
              </Button>
            </div>
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("医生 ID", "Doctor ID")}</p>
            <Input
              value={doctorIdInput}
              onChange={event => onDoctorIdInputChange(event.target.value)}
              placeholder="e.g. 123"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("金额区间（分）", "Amount range (minor unit)")}</p>
            <div className="flex items-center gap-2">
              <Input
                value={amountMinInput}
                onChange={event => onAmountMinChange(event.target.value)}
                placeholder="min"
                inputMode="numeric"
              />
              <span className="text-sm text-muted-foreground">-</span>
              <Input
                value={amountMaxInput}
                onChange={event => onAmountMaxChange(event.target.value)}
                placeholder="max"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("创建时间从", "Created from")}</p>
            <Input
              value={createdAtFrom}
              onChange={event => onCreatedAtFromChange(event.target.value)}
              type="datetime-local"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("创建时间到", "Created to")}</p>
            <Input
              value={createdAtTo}
              onChange={event => onCreatedAtToChange(event.target.value)}
              type="datetime-local"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("预约时间从", "Scheduled from")}</p>
            <Input
              value={scheduledAtFrom}
              onChange={event => onScheduledAtFromChange(event.target.value)}
              type="datetime-local"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("预约时间到", "Scheduled to")}</p>
            <Input
              value={scheduledAtTo}
              onChange={event => onScheduledAtToChange(event.target.value)}
              type="datetime-local"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("预约状态", "Appointment status")}</p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={event => onStatusFilterChange(event.target.value)}
            >
              {appointmentStatusOptions.map(value => (
                <option key={value} value={value}>
                  {value || tr("全部", "All")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("支付状态", "Payment status")}</p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={paymentStatusFilter}
              onChange={event => onPaymentStatusFilterChange(event.target.value)}
            >
              {paymentStatusOptions.map(value => (
                <option key={value} value={value}>
                  {value || tr("全部", "All")}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
            <input
              type="checkbox"
              checked={hasRiskFilter}
              onChange={event => onHasRiskFilterChange(event.target.checked)}
            />
            {tr("仅显示有风险", "Risk only")}
          </label>
          <div className="w-full max-w-[220px] space-y-1">
            <p className="text-xs text-muted-foreground">{tr("排序字段", "Sort by")}</p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sortBy}
              onChange={event =>
                onSortByChange(
                  event.target.value as
                    | "createdAt"
                    | "scheduledAt"
                    | "amount"
                    | "status"
                    | "paymentStatus"
                    | "id"
                )
              }
            >
              <option value="createdAt">{tr("创建时间", "Created time")}</option>
              <option value="scheduledAt">{tr("预约时间", "Scheduled time")}</option>
              <option value="amount">{tr("金额", "Amount")}</option>
              <option value="status">{tr("状态", "Status")}</option>
              <option value="paymentStatus">{tr("支付状态", "Payment status")}</option>
              <option value="id">{tr("ID", "ID")}</option>
            </select>
          </div>
          <div className="w-full max-w-[140px] space-y-1">
            <p className="text-xs text-muted-foreground">{tr("排序方向", "Direction")}</p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sortDirection}
              onChange={event => onSortDirectionChange(event.target.value as "asc" | "desc")}
            >
              <option value="desc">{tr("倒序", "Desc")}</option>
              <option value="asc">{tr("正序", "Asc")}</option>
            </select>
          </div>
          <div className="w-full max-w-[140px] space-y-1">
            <p className="text-xs text-muted-foreground">{tr("每页条数", "Page size")}</p>
            <Input
              value={String(pageSize)}
              onChange={event => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next > 0 && next <= 200) {
                  onPageSizeChange(next);
                }
              }}
              type="number"
              min={1}
              max={200}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onRefresh}>
            {tr("刷新", "Refresh")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {tr("分页", "Page")} {page} / {totalPages}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            {tr("上一页", "Prev")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            {tr("下一页", "Next")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
