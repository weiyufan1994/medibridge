import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";

export function readVisitRoomAccessToken(input: {
  search: string;
  historyState: unknown;
}) {
  const urlToken = new URLSearchParams(input.search).get("t")?.trim();
  if (urlToken) {
    return urlToken;
  }
  const stateToken = (
    input.historyState as { visitAccessToken?: unknown } | null
  )?.visitAccessToken;
  return typeof stateToken === "string" ? stateToken.trim() : "";
}

export function buildSanitizedVisitRoomLocation(input: {
  href: string;
  historyState: unknown;
  token: string;
}) {
  const nextUrl = new URL(input.href);
  nextUrl.searchParams.delete("t");
  return {
    path: `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    state: {
      ...((input.historyState as Record<string, unknown> | null) ?? {}),
      visitAccessToken: input.token,
    },
  };
}

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return readVisitRoomAccessToken({
    search: window.location.search,
    historyState: window.history.state,
  });
}

export function useVisitRoomAccess(lang: "en" | "zh") {
  const [, params] = useRoute<{ id: string }>("/visit/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      return;
    }
    const sanitized = buildSanitizedVisitRoomLocation({
      href: window.location.href,
      historyState: window.history.state,
      token,
    });
    window.history.replaceState(
      sanitized.state,
      document.title,
      sanitized.path
    );
  }, [token]);

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
