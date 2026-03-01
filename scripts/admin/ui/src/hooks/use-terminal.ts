import { useState, useCallback, useRef } from "react";
import type { TerminalLine } from "../types";

export function useTerminal() {
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const appendLine = useCallback((text: string, cls: string) => {
    setLines((prev) => [...prev, { text, cls }]);
  }, []);

  const run = useCallback(
    (url: string): Promise<boolean> => {
      setVisible(true);
      setLines([]);

      return new Promise((resolve) => {
        resolveRef.current = resolve;

        fetch(url, { method: "POST" }).then((res) => {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";

          const read = (): void => {
            reader.read().then((result) => {
              if (result.done) {
                resolve(true);
                resolveRef.current = null;
                return;
              }
              buf += decoder.decode(result.value, { stream: true });
              const parts = buf.split("\n\n");
              buf = parts.pop()!;
              for (const part of parts) {
                const line = part.replace(/^data: /, "");
                if (!line) continue;
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === "stdout") {
                    appendLine(msg.data, "stdout");
                  } else if (msg.type === "stderr") {
                    appendLine(msg.data, "stderr");
                  } else if (msg.type === "exit") {
                    if (msg.data === 0) {
                      appendLine("\nDone (exit 0)", "exit-success");
                    } else {
                      appendLine("\nFailed (exit " + msg.data + ")", "exit-fail");
                    }
                    resolve(msg.data === 0);
                    resolveRef.current = null;
                  } else if (msg.type === "error") {
                    appendLine("Error: " + msg.data, "stderr");
                    resolve(false);
                    resolveRef.current = null;
                  }
                } catch {
                  // ignore parse errors
                }
              }
              read();
            });
          };
          read();
        });
      });
    },
    [appendLine]
  );

  const close = useCallback(() => {
    setVisible(false);
    setLines([]);
  }, []);

  return { visible, lines, run, close };
}
