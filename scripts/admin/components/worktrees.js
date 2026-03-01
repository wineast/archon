/* ── Worktrees Panel Component ─────────────────────────────── */

document.addEventListener('alpine:init', () => {
  Alpine.data('worktreesPanel', () => ({
    data: null,
    currentTab: 'worktrees',
    loading: true,
    selectedBranches: new Set(),

    init() {
      this.refresh();
      window.addEventListener('sse-message', (e) => {
        const msg = e.detail;
        if (msg.section && msg.section !== 'worktrees') return;
        if (msg.type === 'refresh' || msg.type === 'worktrees-refresh') this.refresh();
      });
    },

    async refresh() {
      try {
        const r = await fetch('/api/worktrees/data');
        this.data = await r.json();
      } catch {}
      this.loading = false;
    },

    get tabs() {
      if (!this.data) return [];
      return [
        { id: 'worktrees', label: 'Active Worktrees', count: this.data.worktrees.length },
        { id: 'merged', label: 'Merged Branches', count: this.data.orphanBranches.length },
        { id: 'unmerged', label: 'Unmerged Branches', count: this.data.unmergedBranches.length },
      ];
    },

    get readyToDelete() {
      if (!this.data) return 0;
      return this.data.worktrees.filter((w) => w.merged).length;
    },

    toggleBranch(branch) {
      if (this.selectedBranches.has(branch)) {
        this.selectedBranches.delete(branch);
      } else {
        this.selectedBranches.add(branch);
      }
      // Force Alpine reactivity
      this.selectedBranches = new Set(this.selectedBranches);
    },

    toggleAllMerged(checked) {
      if (checked && this.data) {
        this.selectedBranches = new Set(this.data.orphanBranches.map((b) => b.branch));
      } else {
        this.selectedBranches = new Set();
      }
    },

    async deleteWorktree(name, terminal) {
      const ok = await terminal.run('/api/worktrees/delete?name=' + encodeURIComponent(name));
      setTimeout(() => this.refresh(), 500);
    },

    async deleteBranch(name, terminal) {
      const ok = await terminal.run('/api/worktrees/delete-branch?name=' + encodeURIComponent(name));
      setTimeout(() => this.refresh(), 500);
    },

    async forceDeleteBranch(name, terminal) {
      if (!confirm('This branch has NOT been merged! Delete anyway?\n\n' + name)) return;
      const ok = await terminal.run('/api/worktrees/force-delete?name=' + encodeURIComponent(name));
      setTimeout(() => this.refresh(), 500);
    },

    async bulkDelete(terminal) {
      const branches = Array.from(this.selectedBranches);
      if (!branches.length) return;
      if (!confirm('Delete ' + branches.length + ' merged branches?')) return;
      const ok = await terminal.run(
        '/api/worktrees/bulk-delete?branches=' + encodeURIComponent(branches.join(','))
      );
      this.selectedBranches = new Set();
      setTimeout(() => this.refresh(), 500);
    },

    async deleteAllMerged(terminal) {
      if (!this.data) return;
      const count = this.data.orphanBranches.length;
      if (!confirm('Delete ALL ' + count + ' merged branches?\nThis cannot be undone.')) return;
      const ok = await terminal.run('/api/worktrees/delete-all-merged');
      setTimeout(() => this.refresh(), 500);
    },
  }));
});
