// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHistory } from "../session-history";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { ChatSession } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/use-mobile", () => ({
  useIsMobile: () => false,
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const sessions: ChatSession[] = [
  {
    id: "s1",
    title: "会话一",
    agentId: "a1",
    userId: "u1",
    model: "gpt-4",
    systemPrompt: null,
    messageCount: 3,
    metadata: null,
    source: "chat",
    shareId: null,
    sharedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "s2",
    title: "会话二",
    agentId: "a1",
    userId: "u1",
    model: "gpt-4",
    systemPrompt: null,
    messageCount: 5,
    metadata: null,
    source: "chat",
    shareId: null,
    sharedAt: null,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
  },
];

function renderComponent(overrides?: Partial<React.ComponentProps<typeof SessionHistory>>) {
  const defaults = {
    sessions,
    activeSessionId: null,
    onLoadSession: vi.fn(),
    onDeleteSession: vi.fn().mockResolvedValue(undefined) as unknown as (id: string) => Promise<void>,
    onRenameSession: vi.fn().mockResolvedValue(undefined) as unknown as (id: string, title: string) => Promise<void>,
    onNewChat: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(
      <SidebarProvider>
        <SessionHistory {...props} />
      </SidebarProvider>
    ),
    ...props,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SessionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders session list", () => {
    renderComponent();
    expect(screen.getByText("会话一")).toBeInTheDocument();
    expect(screen.getByText("会话二")).toBeInTheDocument();
  });

  it("opens dropdown menu with rename and delete options", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Find the dropdown trigger buttons (EllipsisVerticalIcon buttons)
    const triggers = screen.getAllByRole("button", { hidden: true });
    // The menu action triggers should contain the ellipsis icons
    const menuTriggers = triggers.filter((btn) =>
      btn.closest("[data-sidebar=menu-action]")
    );
    expect(menuTriggers.length).toBe(2);

    await user.click(menuTriggers[0]);

    await waitFor(() => {
      expect(screen.getByText("重命名")).toBeInTheDocument();
      expect(screen.getByText("删除")).toBeInTheDocument();
    });
  });

  it("shows delete confirmation dialog and calls onDeleteSession on confirm", async () => {
    const user = userEvent.setup();
    const { onDeleteSession } = renderComponent();

    // Open dropdown for first session
    const menuTriggers = screen
      .getAllByRole("button", { hidden: true })
      .filter((btn) => btn.closest("[data-sidebar=menu-action]"));
    await user.click(menuTriggers[0]);

    // Click delete
    await user.click(screen.getByText("删除"));

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText("删除会话")).toBeInTheDocument();
      expect(screen.getByText("确定要删除这个会话吗？此操作无法撤销。")).toBeInTheDocument();
    });

    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "删除" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onDeleteSession).toHaveBeenCalledWith("s1");
    });
  });

  it("shows rename dialog and calls onRenameSession on save", async () => {
    const user = userEvent.setup();
    const { onRenameSession } = renderComponent();

    // Open dropdown for first session
    const menuTriggers = screen
      .getAllByRole("button", { hidden: true })
      .filter((btn) => btn.closest("[data-sidebar=menu-action]"));
    await user.click(menuTriggers[0]);

    // Click rename
    await user.click(screen.getByText("重命名"));

    // Rename dialog should appear with current title
    await waitFor(() => {
      expect(screen.getByText("重命名会话")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("输入新标题");
    expect(input).toHaveValue("会话一");

    // Clear and type new title
    await user.clear(input);
    await user.type(input, "新标题");

    // Click save
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onRenameSession).toHaveBeenCalledWith("s1", "新标题");
    });
  });

  it("calls onNewChat when clicking new chat button", async () => {
    const user = userEvent.setup();
    const { onNewChat } = renderComponent();

    await user.click(screen.getByText("新对话"));
    expect(onNewChat).toHaveBeenCalled();
  });

  it("shows empty state when no sessions", () => {
    renderComponent({ sessions: [] });
    expect(screen.getByText("暂无历史会话")).toBeInTheDocument();
  });
});
