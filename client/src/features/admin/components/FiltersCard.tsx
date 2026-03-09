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
  onRefresh,
}: FiltersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("筛选", "Filters")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
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
        <Button type="button" variant="outline" onClick={onRefresh}>
          {tr("刷新", "Refresh")}
        </Button>
      </CardContent>
    </Card>
  );
}
