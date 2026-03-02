import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAppointmentForm,
  type AppointmentType,
} from "@/features/appointment/hooks/useAppointmentForm";
import { getAppointmentCopy } from "@/features/appointment/copy";

type AppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
};

export function AppointmentModal({
  open,
  onOpenChange,
  doctorId,
  sessionId,
  resolved,
}: AppointmentModalProps) {
  const t = getAppointmentCopy(resolved);
  const {
    bookingEmail,
    bookingScheduledAt,
    bookingType,
    createAppointmentMutation,
    setBookingEmail,
    setBookingScheduledAt,
    setBookingType,
    handleCreateBooking,
  } = useAppointmentForm({
    doctorId,
    sessionId,
    resolved,
    open,
    onBooked: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.bookingTitle}</DialogTitle>
          <DialogDescription>{t.bookingDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="booking-email">{t.bookingEmail}</Label>
            <Input
              id="booking-email"
              type="email"
              value={bookingEmail}
              onChange={event => setBookingEmail(event.target.value)}
              placeholder={t.bookingEmailPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-time">{t.bookingTime}</Label>
            <Input
              id="booking-time"
              type="datetime-local"
              value={bookingScheduledAt}
              onChange={event => setBookingScheduledAt(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-type">{t.bookingType}</Label>
            <select
              id="booking-type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={bookingType}
              onChange={event =>
                setBookingType(event.target.value as AppointmentType)
              }
            >
              <option value="online_chat">{t.bookingTypeOnline}</option>
              <option value="video_call">{t.bookingTypeVideo}</option>
              <option value="in_person">{t.bookingTypeInPerson}</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.bookingCancel}
          </Button>
          <Button
            onClick={() => void handleCreateBooking()}
            disabled={createAppointmentMutation.isPending}
          >
            {createAppointmentMutation.isPending
              ? t.bookingCreating
              : t.bookingConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
