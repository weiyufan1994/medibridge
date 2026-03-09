import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/features/admin/utils/adminFormatting";

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
};

type AppointmentsCardProps = {
  tr: TranslateFn;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  items: AppointmentListItem[];
  onSelectAppointment: (id: number) => void;
};

export function AppointmentsCard({
  tr,
  locale,
  isLoading,
  errorMessage,
  items,
  onSelectAppointment,
}: AppointmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("预约列表（最新 50 条）", "Appointments (Latest 50)")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载预约...", "Loading appointments...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">{tr("支付", "Payment")}</th>
                  <th className="px-2 py-2 text-left">Amount</th>
                  <th className="px-2 py-2 text-left">{tr("医生", "Doctor")}</th>
                  <th className="px-2 py-2 text-left">{tr("分诊会话", "Triage Session")}</th>
                  <th className="px-2 py-2 text-left">{tr("创建时间", "Created")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b hover:bg-slate-50"
                    onClick={() => onSelectAppointment(item.id)}
                  >
                    <td className="px-2 py-2">{item.id}</td>
                    <td className="px-2 py-2">{item.email}</td>
                    <td className="px-2 py-2">{item.status}</td>
                    <td className="px-2 py-2">{item.paymentStatus}</td>
                    <td className="px-2 py-2">
                      {item.amount} {item.currency.toUpperCase()}
                    </td>
                    <td className="px-2 py-2">{item.doctorId}</td>
                    <td className="px-2 py-2">{item.triageSessionId}</td>
                    <td className="px-2 py-2">{formatDate(item.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
