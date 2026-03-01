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
  hasTerminal?: boolean;
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

export interface ChangedFile {
  status: string; // M=modified, A=added, D=deleted, R=renamed
  path: string;
}

export interface FileStatusEntry {
  x: string; // staging area status
  y: string; // working tree status
  path: string;
}

export interface StatusData {
  upstream: StatusCardData;
  current: StatusCardData;
  commits: CommitInfo[];
  diffStat: string;
  changedFiles: ChangedFile[];
  files: FileStatusEntry[];
}

export interface MergeCheckData {
  status: "clean" | "conflict" | "behind" | "up_to_date" | "merged";
  message: string;
}

export interface TerminalLine {
  text: string;
  cls: string;
}
