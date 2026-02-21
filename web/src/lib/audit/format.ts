import type { AuditLogAction, AuditLogResourceType } from "@/db/schema";

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${h}:${m}`;
}

export const RESOURCE_TYPE_LABELS: Record<AuditLogResourceType, string> = {
  tool: "工具",
  function: "函数",
  component: "组件",
  schema: "Schema",
  dataset: "数据集",
  wiki: "Wiki",
  model_config: "模型配置",
  eval_case: "评测用例",
  eval_judge_config: "评测裁判",
  object_type: "对象类型",
  object_relation: "对象关系",
  chat_config: "对话配置",
  memory_config: "记忆配置",
  memory: "记忆",
  mcp_server: "MCP 服务器",
  skill: "技能",
};

export const ACTION_LABELS: Record<AuditLogAction, string> = {
  created: "创建了",
  updated: "更新了",
  deleted: "删除了",
  restored: "恢复了",
  permanently_deleted: "永久删除了",
};

export function formatAuditAction(
  action: AuditLogAction,
  resourceType: AuditLogResourceType,
  resourceName?: string | null
): string {
  const actionLabel = ACTION_LABELS[action];
  const typeLabel = RESOURCE_TYPE_LABELS[resourceType];
  if (resourceName) {
    return `${actionLabel}${typeLabel} ${resourceName}`;
  }
  return `${actionLabel}${typeLabel}`;
}
