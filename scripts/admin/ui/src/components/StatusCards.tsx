import type { StatusData } from "../types";

function StatusBadges({
  data,
}: {
  data?: { staged: number; unstaged: number; untracked: number; ahead?: number; behind?: number };
}) {
  if (!data) return null;
  return (
    <>
      {data.staged > 0 && (
        <span className="wt-badge staged">{data.staged} 已暂存</span>
      )}
      {data.unstaged > 0 && (
        <span className="wt-badge dirty">{data.unstaged} 已修改</span>
      )}
      {data.untracked > 0 && (
        <span className="wt-badge untracked">{data.untracked} 未跟踪</span>
      )}
      {data.staged === 0 && data.unstaged === 0 && data.untracked === 0 && (
        <span className="wt-badge clean">干净</span>
      )}
      {(data.ahead ?? 0) > 0 && (
        <span className="wt-badge ahead">&uarr;{data.ahead} 领先</span>
      )}
      {(data.behind ?? 0) > 0 && (
        <span className="wt-badge behind">&darr;{data.behind} 落后</span>
      )}
    </>
  );
}

interface StatusCardsProps {
  data: StatusData;
}

export function StatusCards({ data }: StatusCardsProps) {
  return (
    <div className="expanded-status">
      {/* Cards */}
      <div className="wt-status">
        <div className="wt-card">
          <div className="wt-card-header">&uarr; 上游</div>
          <div className="wt-card-branch">
            {data.upstream?.branch || "..."}
          </div>
          <div className="wt-card-meta">
            <StatusBadges data={data.upstream} />
          </div>
        </div>
        <div className="wt-card">
          <div className="wt-card-header">&#x25CF; 当前</div>
          <div className="wt-card-branch">
            {data.current?.branch || "..."}
          </div>
          <div className="wt-card-meta">
            <StatusBadges data={data.current} />
          </div>
        </div>
      </div>

      {/* Commits */}
      {data.commits && data.commits.length > 0 && (
        <div>
          <div className="commits-header">
            <span className="commits-title">提交记录</span>
            <span className="commits-count">{data.commits.length}</span>
          </div>
          <div className="commits-list">
            {data.commits.map((c) => (
              <div key={c.hash} className="commit-row">
                <span className="commit-hash">{c.hash}</span>
                <span className="commit-subject">{c.subject}</span>
                <span className="commit-meta">
                  <span>{c.author}</span>
                  <span>{c.date}</span>
                </span>
              </div>
            ))}
          </div>
          {data.diffStat && (
            <details className="diff-stat-details">
              <summary className="diff-stat-summary">变更文件</summary>
              <pre className="diff-stat-content">{data.diffStat}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
