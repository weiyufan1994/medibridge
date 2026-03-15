import "../server/_core/loadEnv";
import { randomUUID } from "node:crypto";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";
import * as authRepo from "../server/modules/auth/repo";

function createReq() {
  return {
    headers: {
      host: "127.0.0.1:3000",
    },
    protocol: "http",
    get(name: string) {
      const key = name.toLowerCase();
      return key === "host" ? "127.0.0.1:3000" : undefined;
    },
  } as TrpcContext["req"];
}

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    req: createReq(),
    res: {} as TrpcContext["res"],
    user,
    userId: user?.id ?? null,
    deviceId: null,
  };
}

async function ensureFormalUser() {
  const email = `postgres-verify-${Date.now()}@example.com`;
  const user = await authRepo.findOrCreateFormalUserByEmail({
    email,
    openId: `postgres-verify-${randomUUID()}`,
    loginMethod: "email_otp",
  });

  if (!user) {
    throw new Error("Failed to create verification user");
  }

  return user;
}

async function main() {
  const user = await ensureFormalUser();
  const caller = appRouter.createCaller(createContext(user));

  const hospitals = await caller.hospitals.getAll();
  if (hospitals.length === 0) {
    throw new Error("No hospitals found");
  }

  const doctorSearch = await caller.doctors.search({
    keywords: ["心内科"],
    limit: 5,
    lang: "zh",
  });
  if (doctorSearch.length === 0) {
    throw new Error("Doctor search returned no results");
  }

  const triageSession = await caller.ai.createSession();
  const triageReply = await caller.ai.sendMessage({
    sessionId: triageSession.sessionId,
    content: "最近反复胸痛并伴有心悸，想确认应该挂什么科。",
    lang: "zh",
  });

  const appointmentCheckout = await caller.appointments.createV2({
    doctorId: doctorSearch[0]!.doctor.id,
    contact: {
      email: user.email ?? "",
    },
    appointmentType: "online_chat",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    triageSessionId: triageSession.sessionId,
    packageId: "chat_standard_60m",
    intake: {
      chiefComplaint: "胸痛、心悸",
      duration: "3天",
      medicalHistory: "无",
    },
  });

  const adminCaller = appRouter.createCaller(
    createContext({
      ...user,
      role: "admin",
    })
  );
  const adminAppointments = await adminCaller.system.adminAppointments({
    page: 1,
    pageSize: 10,
    emailQuery: user.email ?? undefined,
  });

  console.log(
    JSON.stringify(
      {
        hospitals: hospitals.length,
        doctorSearch: {
          count: doctorSearch.length,
          firstDoctor: {
            id: doctorSearch[0]!.doctor.id,
            name: doctorSearch[0]!.doctor.name,
            department: doctorSearch[0]!.department.name,
          },
        },
        aiTriage: {
          sessionId: triageSession.sessionId,
          replyPreview: triageReply.reply.slice(0, 120),
          isComplete: triageReply.isComplete,
          sessionStatus: triageReply.sessionStatus,
        },
        appointmentCheckout: {
          appointmentId: appointmentCheckout.appointmentId,
          status: appointmentCheckout.status,
          paymentStatus: appointmentCheckout.paymentStatus,
          checkoutUrl: appointmentCheckout.checkoutUrl,
        },
        adminAppointments: {
          total: adminAppointments.total,
          returned: adminAppointments.items.length,
          firstAppointmentId: adminAppointments.items[0]?.id ?? null,
        },
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error("[verify-core-postgres-flows] failed", error);
  process.exit(1);
});
