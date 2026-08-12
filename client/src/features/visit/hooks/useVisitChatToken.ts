import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const REFRESH_AHEAD_MS = 60_000;

type VisitChatTokenState = {
  token: string;
  expiresAt: Date;
  appointmentId: number;
  sourceToken: string;
};

type VisitChatTokenErrorState = {
  error: Error;
  appointmentId: number;
  sourceToken: string;
};

export function getVisitChatRefreshDelay(expiresAt: Date, now = Date.now()) {
  const delay = expiresAt.getTime() - now - REFRESH_AHEAD_MS;
  return delay > 0 ? delay : null;
}

export function useVisitChatToken(input: {
  appointmentId: number;
  sourceToken: string;
  enabled: boolean;
}) {
  const [chatToken, setChatToken] = useState<VisitChatTokenState | null>(null);
  const [errorState, setErrorState] = useState<VisitChatTokenErrorState | null>(
    null
  );
  const exchangeStartedRef = useRef(false);
  const exchangeMutation =
    trpc.appointments.exchangeVisitChatToken.useMutation();
  const refreshMutation = trpc.appointments.refreshVisitChatToken.useMutation();

  useEffect(() => {
    setChatToken(null);
    setErrorState(null);
    exchangeStartedRef.current = false;
  }, [input.appointmentId, input.sourceToken]);

  useEffect(() => {
    if (!input.enabled || exchangeStartedRef.current) {
      return;
    }
    let cancelled = false;
    exchangeStartedRef.current = true;
    void exchangeMutation
      .mutateAsync({
        appointmentId: input.appointmentId,
        token: input.sourceToken,
      })
      .then(result => {
        if (!cancelled) {
          setChatToken({
            token: result.token,
            expiresAt: result.expiresAt,
            appointmentId: input.appointmentId,
            sourceToken: input.sourceToken,
          });
        }
      })
      .catch(cause => {
        if (!cancelled) {
          setErrorState({
            error: cause instanceof Error ? cause : new Error("TOKEN_INVALID"),
            appointmentId: input.appointmentId,
            sourceToken: input.sourceToken,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input.appointmentId, input.enabled, input.sourceToken]);

  const currentChatToken =
    chatToken?.appointmentId === input.appointmentId &&
    chatToken.sourceToken === input.sourceToken
      ? chatToken
      : null;
  const currentError =
    errorState?.appointmentId === input.appointmentId &&
    errorState.sourceToken === input.sourceToken
      ? errorState.error
      : null;

  useEffect(() => {
    if (!input.enabled || !currentChatToken) {
      return;
    }
    const refreshDelay = getVisitChatRefreshDelay(currentChatToken.expiresAt);
    if (refreshDelay === null) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refreshMutation
        .mutateAsync({
          appointmentId: input.appointmentId,
          token: currentChatToken.token,
        })
        .then(result => {
          if (!cancelled) {
            setChatToken({
              token: result.token,
              expiresAt: result.expiresAt,
              appointmentId: input.appointmentId,
              sourceToken: input.sourceToken,
            });
          }
        })
        .catch(cause => {
          if (!cancelled) {
            setChatToken(null);
            setErrorState({
              error:
                cause instanceof Error ? cause : new Error("TOKEN_INVALID"),
              appointmentId: input.appointmentId,
              sourceToken: input.sourceToken,
            });
          }
        });
    }, refreshDelay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentChatToken, input.appointmentId, input.enabled, input.sourceToken]);

  return {
    token: currentChatToken?.token ?? null,
    error: currentError,
    isLoading: input.enabled && !currentChatToken && !currentError,
  };
}
