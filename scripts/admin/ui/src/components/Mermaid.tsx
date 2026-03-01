import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#e6f5f2",
      primaryTextColor: "#0f7b6c",
      primaryBorderColor: "#0f7b6c",
      lineColor: "#c5cbd5",
      secondaryColor: "#f1f3f6",
      tertiaryColor: "#fef8e7",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      fontSize: "13px",
    },
  });
}

let idCounter = 0;

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    init();
    let cancelled = false;
    const id = `mermaid-${++idCounter}`;
    mermaid.render(id, chart).then(({ svg: rendered }) => {
      if (!cancelled) setSvg(rendered);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [chart]);

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
