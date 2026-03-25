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
    title: "Session A",
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
    title: "Session B",
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

function renderComponent(
  overrides?: Partial<React.ComponentProps<typeof SessionHistory>>,
) {
  const defaults = {
    sessions,
    activeSessionId: null,
    onLoadSession: vi.fn(),
    onDeleteSession: vi.fn().mockResolvedValue(undefined) as unknown as (
      id: string,
    ) => Promise<void>,
    onRenameSession: vi.fn().mockResolvedValue(undefined) as unknown as (
      id: string,
      title: string,
    ) => Promise<void>,
    onNewChat: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(
      <SidebarProvider>
        <SessionHistory {...props} />
      </SidebarProvider>,
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
    expect(screen.getByText("Session A")).toBeInTheDocument();
    expect(screen.getByText("Session B")).toBeInTheDocument();
  });

  it("opens dropdown menu with rename and delete options", async () => {
    const user = userEvent.setup();
    renderComponent();

    // Find the dropdown trigger buttons (EllipsisVerticalIcon buttons)
    const triggers = screen.getAllByRole("button", { hidden: true });
    // The menu action triggers should contain the ellipsis icons
    const menuTriggers = triggers.filter((btn) =>
      btn.closest("[data-sidebar=menu-action]"),
    );
    expect(menuTriggers.length).toBe(2);

    await user.click(menuTriggers[0]);

    await waitFor(() => {
      expect(screen.getByText("Rename")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
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
    await user.click(screen.getByText("Delete"));

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText("Delete conversation")).toBeInTheDocument();
      expect(
        screen.getByText("Delete this conversation? This cannot be undone."),
      ).toBeInTheDocument();
    });

    // Click confirm
    const confirmBtn = screen.getByRole("button", { name: "Delete" });
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
    await user.click(screen.getByText("Rename"));

    // Rename dialog should appear with current title
    await waitFor(() => {
      expect(screen.getByText("Rename conversation")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("New title");
    expect(input).toHaveValue("Session A");

    // Clear and type new title
    await user.clear(input);
    await user.type(input, "New title");

    // Click save
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onRenameSession).toHaveBeenCalledWith("s1", "New title");
    });
  });

  it("calls onNewChat when clicking new chat button", async () => {
    const user = userEvent.setup();
    const { onNewChat } = renderComponent();

    await user.click(screen.getByText("New chat"));
    expect(onNewChat).toHaveBeenCalled();
  });

  it("shows empty state when no sessions", () => {
    renderComponent({ sessions: [] });
    expect(screen.getByText("No chat history yet")).toBeInTheDocument();
  });
});
