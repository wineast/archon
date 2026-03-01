/**
 * Transition Hooks — post-hook registry for task status transitions.
 *
 * Pattern matching: { type?, from?, to? }
 *   { to: "running" } — any type, any from → running
 *   {} — matches every transition
 *
 * Post-hooks run after status mutation for side effects.
 * Errors are logged but don't abort the transition.
 */

export function createTransitionHooks() {
  /** @type {{ pattern: object, fn: function }[]} */
  const hooks = [];

  function matches(pattern, ctx) {
    if (pattern.type && pattern.type !== ctx.type) return false;
    if (pattern.from && pattern.from !== ctx.from) return false;
    if (pattern.to && pattern.to !== ctx.to) return false;
    return true;
  }

  /**
   * Register a post-hook.
   * @param {object} pattern - { type?, from?, to? }
   * @param {(ctx: object) => Promise<void>} fn
   */
  function post(pattern, fn) {
    hooks.push({ pattern, fn });
  }

  /**
   * Run all matching post-hooks in order.
   * @param {object} ctx - { type, id, from, to, dirs }
   */
  async function run(ctx) {
    for (const h of hooks) {
      if (!matches(h.pattern, ctx)) continue;
      try {
        await h.fn(ctx);
      } catch (e) {
        console.error(
          `[hooks] post error ${ctx.type}/${ctx.id} ${ctx.from}→${ctx.to}:`,
          e.message
        );
      }
    }
  }

  return { post, run };
}
