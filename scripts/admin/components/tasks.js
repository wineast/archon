/* ── Tasks Panel Component ─────────────────────────────────── */

document.addEventListener('alpine:init', () => {
  Alpine.data('tasksPanel', () => ({
    data: null,
    currentTab: 'all',
    currentFilter: 'all',
    loading: true,

    init() {
      this.refresh();
      window.addEventListener('sse-message', (e) => {
        const msg = e.detail;
        if (msg.section && msg.section !== 'tasks') return;
        if (msg.type === 'refresh' || msg.type === 'tasks-refresh') this.refresh();
        if (msg.type === 'scheduler-state' && this.data) {
          this.data.scheduler.enabled = msg.data.enabled;
        }
        if (msg.type === 'scheduler-log' && this.data) {
          if (!this.data.scheduler.logs) this.data.scheduler.logs = [];
          this.data.scheduler.logs.push(msg.data);
          if (this.data.scheduler.logs.length > 100) this.data.scheduler.logs.shift();
        }
      });
    },

    async refresh() {
      try {
        const r = await fetch('/api/tasks/data');
        this.data = await r.json();
      } catch {}
      this.loading = false;
    },

    get stats() {
      if (!this.data) return {};
      return this.data.stats;
    },

    get tabs() {
      if (!this.data) return [];
      const s = this.data.stats;
      return [
        { id: 'all', label: 'All', count: s.total },
        { id: 'todo', label: 'Todo', count: s.todoCount },
        { id: 'issues', label: 'Issues', count: s.issueCount },
        { id: 'running', label: 'Running', count: s.running },
        { id: 'logs', label: 'Logs', count: this.data.scheduler.logs ? this.data.scheduler.logs.length : 0 },
      ];
    },

    get filteredTasks() {
      if (!this.data) return [];
      let tasks = this.data.tasks.slice();
      if (this.currentTab === 'todo') tasks = tasks.filter((t) => t.type === 'todo');
      else if (this.currentTab === 'issues') tasks = tasks.filter((t) => t.type === 'issue');
      else if (this.currentTab === 'running') tasks = tasks.filter((t) => t.status === 'running');

      if (this.currentFilter !== 'all') {
        tasks = tasks.filter((t) => t.priority === this.currentFilter);
      }

      const order = { running: 0, ready: 1, open: 2, pending: 3, backlog: 4, done: 5, closed: 6 };
      tasks.sort((a, b) => {
        const sa = order[a.status] ?? 3;
        const sb = order[b.status] ?? 3;
        if (sa !== sb) return sa - sb;
        return a.priority.localeCompare(b.priority);
      });

      return tasks;
    },

    get reversedLogs() {
      if (!this.data || !this.data.scheduler.logs) return [];
      return this.data.scheduler.logs.slice().reverse();
    },

    async moveStatus(task, to) {
      try {
        const r = await fetch('/api/tasks/move-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: task.type, id: task.id, to }),
        });
        if (r.ok) this.refresh();
      } catch {}
    },

    canMarkReady(task) {
      return task.type === 'todo'
        ? ['pending', 'backlog'].includes(task.folder)
        : ['open'].includes(task.folder);
    },

    async toggleScheduler() {
      try {
        const r = await fetch('/api/tasks/scheduler/toggle', { method: 'POST' });
        const d = await r.json();
        if (this.data) this.data.scheduler.enabled = d.enabled;
      } catch {}
    },

    async refreshLogs() {
      try {
        const r = await fetch('/api/tasks/scheduler/logs');
        const logs = await r.json();
        if (this.data) this.data.scheduler.logs = logs;
      } catch {}
    },

    renderChain(chain) {
      if (!chain) return '';
      return Object.entries(chain)
        .map(([k, present]) => {
          const label = k.replace(/\.md$/, '');
          const cls = present ? 'present' : 'missing';
          const mark = present ? ' \u2713' : ' \u2717';
          return '<span class="chain-dot ' + cls + '" title="' + esc(label + mark) + '"></span>';
        })
        .join('');
    },

    formatLogTime(time) {
      return time.split('T')[1]?.split('.')[0] || time;
    },
  }));
});
