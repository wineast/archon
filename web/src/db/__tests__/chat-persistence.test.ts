import { config } from "dotenv";
config({ path: ".env.development.local" });
config({ path: ".env.local" });

import { describe, it, expect, afterAll } from "vitest";
import {
  createSession,
  saveMessage,
  getSessionMessages,
  getSession,
  deleteSession,
} from "../chat-persistence";

// Track created sessions for cleanup (cascade deletes messages)
const cleanupIds: string[] = [];

function testSessionId() {
  const id = crypto.randomUUID();
  cleanupIds.push(id);
  return id;
}

afterAll(async () => {
  for (const id of cleanupIds) {
    await deleteSession(id);
  }
});

describe("chat-persistence", () => {
  // ── createSession ──────────────────────────────────────────

  describe("createSession", () => {
    it("creates a session with correct fields", async () => {
      const id = testSessionId();
      const session = await createSession({
        id,
        title: "Test Session",
        model: "gpt-4",
        source: "chat",
      });

      expect(session).toBeDefined();
      expect(session!.id).toBe(id);
      expect(session!.title).toBe("Test Session");
      expect(session!.model).toBe("gpt-4");
      expect(session!.source).toBe("chat");
      expect(session!.messageCount).toBe(0);
    });

    it("returns undefined on duplicate id (onConflictDoNothing)", async () => {
      const id = testSessionId();
      await createSession({ id, title: "First", model: "m1" });
      const dup = await createSession({ id, title: "Second", model: "m2" });

      // onConflictDoNothing + returning() → empty array → undefined
      expect(dup).toBeUndefined();

      // Original session unchanged
      const session = await getSession(id);
      expect(session!.title).toBe("First");
    });

    it("defaults source to 'chat' when not specified", async () => {
      const id = testSessionId();
      await createSession({ id, title: "No Source", model: "m1" });
      const session = await getSession(id);
      expect(session!.source).toBe("chat");
    });
  });

  // ── saveMessage (user) ─────────────────────────────────────

  describe("saveMessage (role=user)", () => {
    it("saves a user message with text parts and extracts content", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      const msgId = crypto.randomUUID();
      await saveMessage({
        id: msgId,
        sessionId,
        role: "user",
        parts: [{ type: "text", text: "Hello world" }],
      });

      const msgs = await getSessionMessages(sessionId);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe(msgId);
      expect(msgs[0].role).toBe("user");
      expect(msgs[0].parts).toEqual([{ type: "text", text: "Hello world" }]);
      expect(msgs[0].content).toBe("Hello world");
    });

    it("joins multiple text parts with newline", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        parts: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
        ],
      });

      const msgs = await getSessionMessages(sessionId);
      expect(msgs[0].content).toBe("Line 1\nLine 2");
    });

    it("increments session messageCount", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        parts: [{ type: "text", text: "msg 1" }],
      });

      let session = await getSession(sessionId);
      expect(session!.messageCount).toBe(1);

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        parts: [{ type: "text", text: "msg 2" }],
      });

      session = await getSession(sessionId);
      expect(session!.messageCount).toBe(2);
    });
  });

  // ── saveMessage (assistant) ────────────────────────────────

  describe("saveMessage (role=assistant)", () => {
    it("saves assistant message with tool parts, content only extracts text", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      const parts = [
        { type: "text", text: "Let me search." },
        {
          type: "tool-search",
          toolCallId: "tc-1",
          state: "output-available",
          input: { q: "test" },
          output: ["result"],
        },
      ];

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        parts,
      });

      const msgs = await getSessionMessages(sessionId);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe("assistant");
      expect(msgs[0].parts).toEqual(parts);
      // content only extracts type:"text" parts
      expect(msgs[0].content).toBe("Let me search.");
    });

    it("sets content to null when no text parts exist", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        parts: [
          {
            type: "tool-search",
            toolCallId: "tc-1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      });

      const msgs = await getSessionMessages(sessionId);
      expect(msgs[0].content).toBeNull();
    });

    it("increments session messageCount", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        parts: [{ type: "text", text: "response" }],
      });

      const session = await getSession(sessionId);
      expect(session!.messageCount).toBe(1);
    });
  });

  // ── getSessionMessages ─────────────────────────────────────

  describe("getSessionMessages", () => {
    it("returns messages ordered by createdAt ascending", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      // Insert 3 messages sequentially
      for (let i = 0; i < 3; i++) {
        await saveMessage({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          parts: [{ type: "text", text: `msg ${i}` }],
        });
      }

      const msgs = await getSessionMessages(sessionId);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].content).toBe("msg 0");
      expect(msgs[1].content).toBe("msg 1");
      expect(msgs[2].content).toBe("msg 2");

      // Verify timestamp ordering
      for (let i = 1; i < msgs.length; i++) {
        expect(msgs[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          msgs[i - 1].createdAt.getTime()
        );
      }
    });

    it("returns empty array for session with no messages", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      const msgs = await getSessionMessages(sessionId);
      expect(msgs).toEqual([]);
    });

    it("does not return messages from other sessions", async () => {
      const sessionA = testSessionId();
      const sessionB = testSessionId();
      await createSession({ id: sessionA, title: "A", model: "m" });
      await createSession({ id: sessionB, title: "B", model: "m" });

      await saveMessage({
        id: crypto.randomUUID(),
        sessionId: sessionA,
        role: "user",
        parts: [{ type: "text", text: "A's message" }],
      });
      await saveMessage({
        id: crypto.randomUUID(),
        sessionId: sessionB,
        role: "user",
        parts: [{ type: "text", text: "B's message" }],
      });

      const msgsA = await getSessionMessages(sessionA);
      expect(msgsA).toHaveLength(1);
      expect(msgsA[0].content).toBe("A's message");

      const msgsB = await getSessionMessages(sessionB);
      expect(msgsB).toHaveLength(1);
      expect(msgsB[0].content).toBe("B's message");
    });
  });

  // ── Concurrent write safety ────────────────────────────────

  describe("concurrent write safety", () => {
    it("messageCount is correct after N concurrent saveMessage calls", async () => {
      const sessionId = testSessionId();
      await createSession({ id: sessionId, title: "t", model: "m" });

      const N = 10;
      const promises = Array.from({ length: N }, (_, i) =>
        saveMessage({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          parts: [{ type: "text", text: `concurrent msg ${i}` }],
        })
      );

      await Promise.all(promises);

      const session = await getSession(sessionId);
      expect(session!.messageCount).toBe(N);

      const msgs = await getSessionMessages(sessionId);
      expect(msgs).toHaveLength(N);
    });
  });
});
