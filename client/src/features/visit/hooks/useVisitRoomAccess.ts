import { useMemo } from "react";
import { useRoute } from "wouter";

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

export function useVisitRoomAccess(lang: "en" | "zh") {
  const [, params] = useRoute<{ id: string }>("/visit/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();
  const validInput =
    Number.isInteger(appointmentId) && appointmentId > 0 && token.length >= 16;

  const accessInput = useMemo(
    () => ({
      appointmentId: validInput ? appointmentId : 1,
      token: validInput ? token : "invalid-token-000",
      lang,
    }),
    [appointmentId, token, validInput, lang]
  );

  return {
    appointmentId,
    token,
    validInput,
    accessInput,
  };
}
