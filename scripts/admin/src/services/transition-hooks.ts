/**
 * Transition Hooks — post-hook registry for task status transitions.
 *
 * Pattern matching: { type?, from?, to? }
 *   { to: "running" } — any type, any from -> running
 *   {} — matches every transition
 *
 * Post-hooks run after status mutation for side effects.
 * Errors are logged but don't abort the transition.
 */

export interface HookPattern {
  type?: string;
  from?: string;
  to?: string;
}

export interface HookContext {
  type: string;
  id: string;
  from: string;
  to: string;
  dirs: {
    PROJECT_ROOT: string;
    WORKTREES_DIR: string;
    TODO_DIR: string;
    ISSUES_DIR: string;
  };
}

export interface TransitionHooks {
  post: (pattern: HookPattern, fn: (ctx: HookContext) => Promise<void>) => void;
  run: (ctx: HookContext) => Promise<void>;
}

export function createTransitionHooks(): TransitionHooks {
  const hooks: Array<{
    pattern: HookPattern;
    fn: (ctx: HookContext) => Promise<void>;
  }> = [];

  function matches(pattern: HookPattern, ctx: HookContext): boolean {
    if (pattern.type && pattern.type !== ctx.type) return false;
    if (pattern.from && pattern.from !== ctx.from) return false;
    if (pattern.to && pattern.to !== ctx.to) return false;
    return true;
  }

  function post(
    pattern: HookPattern,
    fn: (ctx: HookContext) => Promise<void>
  ): void {
    hooks.push({ pattern, fn });
  }

  async function run(ctx: HookContext): Promise<void> {
    for (const h of hooks) {
      if (!matches(h.pattern, ctx)) continue;
      try {
        await h.fn(ctx);
      } catch (e) {
        console.error(
          `[hooks] post error ${ctx.type}/${ctx.id} ${ctx.from}->${ctx.to}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  }

  return { post, run };
}
