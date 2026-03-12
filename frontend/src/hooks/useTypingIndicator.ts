import { useCallback, useRef } from "react";

const TYPING_THROTTLE_MS = 3000;

export function useTypingIndicator(send: (data: string) => boolean) {
  const lastSentRef = useRef(0);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    send(JSON.stringify({ type: "typing" }));
  }, [send]);

  return { sendTyping };
}
