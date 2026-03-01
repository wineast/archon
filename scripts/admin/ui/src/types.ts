// ── Task types ──────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  type: "todo" | "issue";
  status: string;
  priority: string;
  path: string;
  worktree?: string;
  chain?: Record<string, boolean>;
}

export interface TaskStats {
  total: number;
  ready: number;
  running: number;
  completed: number;
  todoCount: number;
  issueCount: number;
}

export interface TasksData {
  tasks: Task[];
  stats: TaskStats;
}

// ── Report types ────────────────────────────────────────────

export interface ChainNode {
  key: string;
  label: string;
  cssClass: string;
  available: boolean;
}

export interface ReportData {
  chain: ChainNode[];
  reports: Record<string, string>;
  branch: string;
  baseBranch?: string;
  verdictSource?: string;
  chainType?: "req" | "defect";
}

export interface StatusCardData {
  branch: string;
  staged: number;
  unstaged: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface StatusData {
  upstream: StatusCardData;
  current: StatusCardData;
  commits: CommitInfo[];
  diffStat: string;
}

export interface MergeCheckData {
  status: "clean" | "conflict" | "behind" | "up_to_date" | "merged";
  message: string;
}

// ── SSE types ───────────────────────────────────────────────

export interface SSEMessage {
  type: string;
  section?: string;
  data?: unknown;
}

export interface TerminalLine {
  text: string;
  cls: string;
}
