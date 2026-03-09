import { useCallback, useEffect, useRef } from "react";
import {
  RECONNECT_DELAYS_MS,
  getWsUrl,
  type IncomingMessagePayload,
  type JoinedPayload,
  type SocketEventEnvelope,
  type StatusPayload,
  type TimerPayload,
  type VisitSocketErrorPayload,
} from "@/features/visit/hooks/useVisits.helpers";

type UseVisitRoomSocketParams = {
  enabled: boolean;
  token: string;
  pollingFatalError: string | null;
  onJoined: (payload: JoinedPayload) => void;
  onIncomingMessage: (payload: IncomingMessagePayload) => void;
  onStatus: (payload: StatusPayload) => void;
  onTimer: (payload: TimerPayload) => void;
  onError: (payload: VisitSocketErrorPayload) => void;
  onSocketClosed: () => void;
  onReconnectingChange: (isReconnecting: boolean) => void;
};

type SocketEventData = Record<string, unknown>;

export function useVisitRoomSocket({
  enabled,
  token,
  pollingFatalError,
  onJoined,
  onIncomingMessage,
  onStatus,
  onTimer,
  onError,
  onSocketClosed,
  onReconnectingChange,
}: UseVisitRoomSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const closedByAppRef = useRef(false);
  const handlersRef = useRef({
    onJoined,
    onIncomingMessage,
    onStatus,
    onTimer,
    onError,
    onSocketClosed,
    onReconnectingChange,
  });

  useEffect(() => {
    handlersRef.current = {
      onJoined,
      onIncomingMessage,
      onStatus,
      onTimer,
      onError,
      onSocketClosed,
      onReconnectingChange,
    };
  }, [
    onJoined,
    onIncomingMessage,
    onStatus,
    onTimer,
    onError,
    onSocketClosed,
    onReconnectingChange,
  ]);

  const sendEvent = useCallback((event: string, data: SocketEventData) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify({ event, data }));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || pollingFatalError) {
      return;
    }

    closedByAppRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const connect = () => {
      const wsUrl = getWsUrl();
      if (!wsUrl) {
        return;
      }

      closeSocket();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        handlersRef.current.onReconnectingChange(false);
        ws.send(
          JSON.stringify({
            event: "room.join",
            data: { token },
          })
        );
      };

      ws.onmessage = event => {
        let envelope: SocketEventEnvelope;
        try {
          envelope = JSON.parse(String(event.data)) as SocketEventEnvelope;
        } catch {
          return;
        }

        if (envelope.event === "room.joined") {
          handlersRef.current.onJoined(envelope.data as JoinedPayload);
          return;
        }

        if (envelope.event === "message.new") {
          handlersRef.current.onIncomingMessage(
            envelope.data as IncomingMessagePayload
          );
          return;
        }

        if (envelope.event === "room.status") {
          handlersRef.current.onStatus(envelope.data as StatusPayload);
          return;
        }

        if (envelope.event === "room.timer") {
          handlersRef.current.onTimer(envelope.data as TimerPayload);
          return;
        }

        if (envelope.event === "error") {
          handlersRef.current.onError(envelope.data as VisitSocketErrorPayload);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        handlersRef.current.onSocketClosed();

        if (!enabled || closedByAppRef.current || pollingFatalError) {
          return;
        }

        handlersRef.current.onReconnectingChange(true);
        const delayMs =
          RECONNECT_DELAYS_MS[
            Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1)
          ];
        reconnectAttemptRef.current += 1;
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      closedByAppRef.current = true;
      clearReconnectTimer();
      closeSocket();
    };
  }, [enabled, token, pollingFatalError]);

  return { sendEvent };
}
