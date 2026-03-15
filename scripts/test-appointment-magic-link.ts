import "../server/_core/loadEnv";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "http",
      headers: { host: "localhost:3000" },
      get(name: string) {
        return name.toLowerCase() === "host" ? "localhost:3000" : undefined;
      },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const caller = appRouter.createCaller(createContext());

  const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const createResult = await caller.appointments.create({
    doctorId: 1,
    appointmentType: "video_call",
    scheduledAt,
    email: "magic.link.test@example.com",
    sessionId: "triage_session_demo_001",
  });

  console.log("[create]", createResult);
  assert(createResult.devLink, "Expected devLink in development mode");

  const parsed = new URL(createResult.devLink);
  const token = parsed.searchParams.get("t");
  assert(token, "Missing token in devLink");

  const detail = await caller.appointments.getByToken({
    appointmentId: createResult.appointmentId,
    token,
  });
  console.log("[getByToken]", {
    id: detail.id,
    status: detail.status,
    scheduledAt: detail.scheduledAt,
    email: detail.email,
  });

  const newScheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const rescheduled = await caller.appointments.rescheduleByToken({
    appointmentId: createResult.appointmentId,
    token,
    newScheduledAt,
  });
  console.log("[rescheduleByToken]", {
    status: rescheduled.status,
    scheduledAt: rescheduled.scheduledAt,
  });

  const resent = await caller.appointments.resendLink({
    appointmentId: createResult.appointmentId,
    email: "magic.link.test@example.com",
  });
  console.log("[resendLink]", resent);
  assert(resent.devLink, "Expected devLink in resendLink response");

  let oldTokenRejected = false;
  try {
    await caller.appointments.getByToken({
      appointmentId: createResult.appointmentId,
      token,
    });
  } catch (error) {
    oldTokenRejected = true;
    console.log("[old token rejected]", (error as Error).message);
  }
  assert(oldTokenRejected, "Old token should be rejected after resendLink");

  const resentUrl = new URL(resent.devLink);
  const newToken = resentUrl.searchParams.get("t");
  assert(newToken, "Missing new token in resent dev link");

  const detailAfterResend = await caller.appointments.getByToken({
    appointmentId: createResult.appointmentId,
    token: newToken,
  });
  console.log("[new token accepted]", {
    id: detailAfterResend.id,
    status: detailAfterResend.status,
  });

  const joinInfo = await caller.appointments.joinInfoByToken({
    appointmentId: createResult.appointmentId,
    token: newToken,
  });
  console.log("[joinInfoByToken]", joinInfo);
}

main().catch(error => {
  console.error("E2E test failed:", error);
  process.exit(1);
});
