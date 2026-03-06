import { ensureAppointmentStatusAllowsVisitV2 } from "./stateMachine";

type ChatPolicyContext = {
  status: string;
  paymentStatus: string;
};

export function canJoinRoom(context: ChatPolicyContext): boolean {
  if (context.status === "ended" && context.paymentStatus === "paid") {
    return true;
  }

  try {
    ensureAppointmentStatusAllowsVisitV2({
      status: context.status as never,
      paymentStatus: context.paymentStatus as never,
    });
    return true;
  } catch {
    return false;
  }
}

export function canSendMessage(context: ChatPolicyContext): boolean {
  return canJoinRoom(context) && (context.status === "paid" || context.status === "active");
}
