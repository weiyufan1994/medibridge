import { memo, useEffect, useRef, useState } from "react";

export const TriageTypewriterMessage = memo(
  function TriageTypewriterMessage(props: {
    text: string;
    speed?: number;
    active?: boolean;
    onProgress?: () => void;
  }) {
    const { text, speed = 20, active = false, onProgress } = props;
    const [displayedText, setDisplayedText] = useState(active ? "" : text);
    const intervalRef = useRef<number | null>(null);
    const cursorRef = useRef(active ? 0 : text.length);
    const isCompletedRef = useRef(!active);
    const latestOnProgressRef = useRef(onProgress);
    const latestTextRef = useRef(text);

    useEffect(() => {
      latestOnProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
      if (latestTextRef.current !== text) {
        latestTextRef.current = text;
        cursorRef.current = active ? 0 : text.length;
        isCompletedRef.current = !active;
        setDisplayedText(active ? "" : text);
      }
    }, [active, text]);

    useEffect(() => {
      if (!active) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        cursorRef.current = text.length;
        isCompletedRef.current = true;
        setDisplayedText(text);
        return;
      }

      if (isCompletedRef.current || intervalRef.current) {
        return;
      }

      intervalRef.current = window.setInterval(() => {
        const nextCursor = Math.min(cursorRef.current + 1, text.length);
        if (nextCursor === cursorRef.current) {
          return;
        }

        cursorRef.current = nextCursor;
        setDisplayedText(text.slice(0, nextCursor));
        latestOnProgressRef.current?.();

        if (nextCursor >= text.length) {
          isCompletedRef.current = true;
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, speed);

      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [active, speed, text]);

    return <p className="whitespace-pre-wrap">{displayedText}</p>;
  },
  (prev, next) =>
    prev.text === next.text &&
    prev.speed === next.speed &&
    prev.active === next.active
);
