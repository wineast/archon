import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { createElement } from "react";
import type { SSEMessage } from "../types";

type SSEListener = (msg: SSEMessage) => void;

const SSEContext = createContext<{
  subscribe: (listener: SSEListener) => () => void;
}>({
  subscribe: () => () => {},
});

export function SSEProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef<Set<SSEListener>>(new Set());

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/events");
      es.onmessage = (e) => {
        try {
          const msg: SSEMessage = JSON.parse(e.data);
          for (const fn of listenersRef.current) fn(msg);
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        es?.close();
        timer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      es?.close();
      clearTimeout(timer);
    };
  }, []);

  const subscribe = useCallback((listener: SSEListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return createElement(SSEContext.Provider, { value: { subscribe } }, children);
}

export function useSSEListener(
  filter: string | null,
  callback: (msg: SSEMessage) => void
) {
  const { subscribe } = useContext(SSEContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return subscribe((msg) => {
      if (filter && msg.section && msg.section !== filter) return;
      callbackRef.current(msg);
    });
  }, [subscribe, filter]);
}
