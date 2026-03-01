import type { ChainNode } from "../types";

interface ChainFlowProps {
  chain: ChainNode[];
}

export function ChainFlow({ chain }: ChainFlowProps) {
  return (
    <div className="chain-flow">
      {chain.map((c, i) => (
        <span key={c.key}>
          <span
            className={`chain-node ${c.cssClass}${!c.available ? " dimmed" : ""}`}
          >
            {c.label}
          </span>
          {i < chain.length - 1 && (
            <span className="chain-arrow">&rarr;</span>
          )}
        </span>
      ))}
    </div>
  );
}
