/**
 * 工具结果通用布局组件
 *
 * 定价、核保、批量核保等渲染器共用的标题和内容区域样式
 */

interface ResultHeaderProps {
  title: string;
}

/** 标题栏 */
export function ResultHeader({ title }: ResultHeaderProps) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="text-sm font-semibold text-foreground">{title}</div>
    </div>
  );
}

/** 内容区域（用在 divide-y 容器内，提供统一 padding） */
export function ResultSection({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}
