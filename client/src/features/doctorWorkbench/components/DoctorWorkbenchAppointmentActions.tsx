import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { getDoctorWorkbenchEndButtonText } from "../presentation";
import type {
  DoctorWorkbenchAppointmentDetail,
  DoctorWorkbenchTranslate,
} from "../types";

export function DoctorWorkbenchAppointmentActions(props: {
  detail: DoctorWorkbenchAppointmentDetail;
  tr: DoctorWorkbenchTranslate;
  onStartConsultation: (appointmentId: number) => void;
  onOpenRoom: (appointmentId: number) => void;
  onCompleteAndSummarize: (appointmentId: number) => void;
  isStarting: boolean;
  isOpeningRoom: boolean;
  isCompleting: boolean;
}) {
  return (
    <SheetFooter className="border-t border-slate-200/80 bg-white/95 px-6 py-5 backdrop-blur">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Stethoscope className="h-4 w-4 text-teal-600" />
          {props.tr(
            "先查看资料，再开始接诊或进入房间。",
            "Review context first, then start the consultation or open the room."
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!props.detail.canStartConsultation || props.isStarting}
            onClick={() => props.onStartConsultation(props.detail.id)}
          >
            {props.isStarting
              ? props.tr("接诊中...", "Starting...")
              : props.tr("开始接诊", "Start Consultation")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!props.detail.canOpenRoom || props.isOpeningRoom}
            onClick={() => props.onOpenRoom(props.detail.id)}
          >
            {props.isOpeningRoom
              ? props.tr("打开中...", "Opening...")
              : props.tr("进入房间", "Open Room")}
          </Button>
          <Button
            type="button"
            disabled={props.isCompleting || !props.detail.canOpenRoom}
            onClick={() => props.onCompleteAndSummarize(props.detail.id)}
          >
            {props.isCompleting
              ? props.tr("处理中...", "Processing...")
              : getDoctorWorkbenchEndButtonText(props.detail, props.tr)}
          </Button>
        </div>
      </div>
    </SheetFooter>
  );
}
