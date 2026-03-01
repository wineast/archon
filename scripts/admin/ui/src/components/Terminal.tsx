import { useEffect, useRef } from "react";
import type { TerminalLine } from "../types";

interface TerminalProps {
  visible: boolean;
  lines: TerminalLine[];
  onClose: () => void;
}

export function Terminal({ visible, lines, onClose }: TerminalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={`terminal${visible ? " visible" : ""}`}>
      <div className="terminal-header">
        <span>终端</span>
        <button
          className="btn"
          onClick={onClose}
          style={{ padding: "2px 8px", fontSize: "0.75em" }}
        >
          关闭
        </button>
      </div>
      <div className="terminal-content" ref={contentRef}>
        {lines.map((line, i) => (
          <div key={i} className={line.cls}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
