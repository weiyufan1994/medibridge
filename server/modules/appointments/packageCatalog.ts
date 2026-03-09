import { TRPCError } from "@trpc/server";

export const APPOINTMENT_TYPE_VALUES = [
  "online_chat",
  "video_call",
  "in_person",
] as const;

export const APPOINTMENT_PACKAGE_VALUES = [
  "chat_quick_30m",
  "chat_standard_60m",
  "chat_extended_24h",
  "video_quick_30m",
  "video_standard_60m",
  "inperson_standard_45m",
] as const;

export type AppointmentPackageId = (typeof APPOINTMENT_PACKAGE_VALUES)[number];
export type AppointmentType = (typeof APPOINTMENT_TYPE_VALUES)[number];

export type AppointmentPackageDefinition = {
  id: AppointmentPackageId;
  appointmentType: AppointmentType;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  durationMinutes: number;
  amount: number;
  currency: "usd";
};

export const APPOINTMENT_PACKAGE_CATALOG: AppointmentPackageDefinition[] = [
  {
    id: "chat_quick_30m",
    appointmentType: "online_chat",
    titleZh: "图文快问（30 分钟）",
    titleEn: "Chat Quick (30 min)",
    descriptionZh: "适合单次明确问题，快速给出方向建议。",
    descriptionEn: "Best for one focused question and quick guidance.",
    durationMinutes: 30,
    amount: 2900,
    currency: "usd",
  },
  {
    id: "chat_standard_60m",
    appointmentType: "online_chat",
    titleZh: "图文标准（60 分钟）",
    titleEn: "Chat Standard (60 min)",
    descriptionZh: "完整沟通病情与检查，适合多数初诊场景。",
    descriptionEn: "Full case discussion for most first-visit scenarios.",
    durationMinutes: 60,
    amount: 4900,
    currency: "usd",
  },
  {
    id: "chat_extended_24h",
    appointmentType: "online_chat",
    titleZh: "图文加长（24 小时）",
    titleEn: "Chat Extended (24h)",
    descriptionZh: "24 小时内可多轮追问，适合复杂病情跟进。",
    descriptionEn: "Multi-round follow-up within 24 hours.",
    durationMinutes: 24 * 60,
    amount: 8900,
    currency: "usd",
  },
  {
    id: "video_quick_30m",
    appointmentType: "video_call",
    titleZh: "视频快诊（30 分钟）",
    titleEn: "Video Quick (30 min)",
    descriptionZh: "短时视频沟通，聚焦核心症状判断。",
    descriptionEn: "Short video consult focused on key symptoms.",
    durationMinutes: 30,
    amount: 6900,
    currency: "usd",
  },
  {
    id: "video_standard_60m",
    appointmentType: "video_call",
    titleZh: "视频标准（60 分钟）",
    titleEn: "Video Standard (60 min)",
    descriptionZh: "标准时长视频咨询，适合综合评估与答疑。",
    descriptionEn: "Standard-length video consult for deeper evaluation.",
    durationMinutes: 60,
    amount: 11900,
    currency: "usd",
  },
  {
    id: "inperson_standard_45m",
    appointmentType: "in_person",
    titleZh: "线下面诊（45 分钟）",
    titleEn: "In-Person Standard (45 min)",
    descriptionZh: "线下面诊时间预留，适合需要当面评估的场景。",
    descriptionEn: "Reserved in-person consultation slot.",
    durationMinutes: 45,
    amount: 14900,
    currency: "usd",
  },
];

export const DEFAULT_PACKAGE_BY_TYPE: Record<AppointmentType, AppointmentPackageId> = {
  online_chat: "chat_standard_60m",
  video_call: "video_standard_60m",
  in_person: "inperson_standard_45m",
};

export function resolveAppointmentPackage(input: {
  appointmentType: AppointmentType;
  packageId?: AppointmentPackageId;
}): AppointmentPackageDefinition {
  const packageId = input.packageId ?? DEFAULT_PACKAGE_BY_TYPE[input.appointmentType];
  const selected = APPOINTMENT_PACKAGE_CATALOG.find(item => item.id === packageId);
  if (!selected) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid appointment package",
    });
  }
  if (selected.appointmentType !== input.appointmentType) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Package does not match appointment type",
    });
  }

  return selected;
}

export function listAppointmentPackages(input: {
  appointmentType?: AppointmentType;
}) {
  const rows = APPOINTMENT_PACKAGE_CATALOG.filter(item =>
    input.appointmentType ? item.appointmentType === input.appointmentType : true
  );
  return rows.map(item => ({
    ...item,
    isDefault: DEFAULT_PACKAGE_BY_TYPE[item.appointmentType] === item.id,
  }));
}
