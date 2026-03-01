/* ── Reports Panel Component ───────────────────────────────── */

const VERDICT_FAIL_KW = ['驳回', '不足', '\u274C'];
const VERDICT_WARN_KW = ['有条件', '部分', '\u26A0\uFE0F'];

document.addEventListener('alpine:init', () => {
  Alpine.data('reportsPanel', () => ({
    worktrees: [],
    selectedWt: null,
    reportData: null,
    activeTab: null,
    loading: true,
    loadingReport: false,
    verdictHtml: '',
    verdictClass: '',
    // Actions state
    statusData: null,
    mergeCheckData: null,
    mergeState: 'idle',
    syncState: 'idle',

    init() {
      this.refreshList();
      window.addEventListener('sse-message', (e) => {
        const msg = e.detail;
        if (msg.section && msg.section !== 'reports') return;
        if (msg.type === 'refresh' || msg.type === 'reports-refresh') {
          this.refreshList();
          if (this.selectedWt) this.loadReport(this.selectedWt);
        }
      });
    },

    async refreshList() {
      try {
        const r = await fetch('/api/reports/list');
        this.worktrees = await r.json();
      } catch {}
      this.loading = false;
    },

    async selectWt(name) {
      this.selectedWt = name;
      this.reportData = null;
      this.verdictHtml = '';
      this.verdictClass = '';
      this.mergeState = 'idle';
      this.syncState = 'idle';
      await this.loadReport(name);
    },

    async loadReport(name) {
      this.loadingReport = true;
      try {
        const r = await fetch('/api/reports/' + encodeURIComponent(name) + '/data');
        this.reportData = await r.json();
        // Set default active tab to last available
        const available = this.reportData.chain.filter((c) => c.available);
        this.activeTab = available.length ? available[available.length - 1].key : null;
        // Render markdown + verdict after DOM updates
        this.$nextTick(() => {
          this.renderAllMarkdown();
          this.extractVerdict();
          this.refreshActions();
        });
      } catch {}
      this.loadingReport = false;
    },

    renderAllMarkdown() {
      if (!this.reportData) return;
      for (const [key, md] of Object.entries(this.reportData.reports)) {
        if (!md) continue;
        const el = document.getElementById('report-content-' + key);
        if (el) {
          let html = marked.parse(md);
          // Rewrite .assets/ image paths
          html = html.replace(
            /src="([^"]*\.assets\/[^"]*)"/g,
            'src="/api/reports/' + encodeURIComponent(this.selectedWt) + '/assets/$1"'
          );
          el.innerHTML = html;
        }
      }
    },

    extractVerdict() {
      if (!this.reportData) return;
      const src = this.reportData.verdictSource;
      if (!src) return;
      const container = document.getElementById('report-content-' + src);
      if (!container) return;

      const h2s = container.querySelectorAll('h2');
      for (const h2 of h2s) {
        const txt = h2.textContent.trim();
        if (txt.includes('Verdict') || txt.includes('\u88C1\u5B9A')) {
          const nodes = [];
          let sib = h2.nextElementSibling;
          while (sib && sib.tagName !== 'H2') {
            nodes.push(sib);
            sib = sib.nextElementSibling;
          }
          const verdictText = nodes.map((n) => n.textContent).join(' ');
          this.verdictHtml = nodes.map((n) => n.outerHTML).join('');

          if (VERDICT_FAIL_KW.some((k) => verdictText.includes(k))) {
            this.verdictClass = 'verdict-banner verdict-fail';
          } else if (VERDICT_WARN_KW.some((k) => verdictText.includes(k))) {
            this.verdictClass = 'verdict-banner verdict-warn';
          } else {
            this.verdictClass = 'verdict-banner verdict-pass';
          }
          break;
        }
      }
    },

    switchTab(key) {
      this.activeTab = key;
    },

    // ── Actions ──────────────────────────────────────────────

    async refreshActions() {
      if (!this.selectedWt) return;
      try {
        const r = await fetch('/api/reports/' + encodeURIComponent(this.selectedWt) + '/status');
        this.statusData = await r.json();
      } catch {}
      try {
        if (this.mergeState === 'success') {
          this.mergeCheckData = { status: 'merged', message: '\u5DF2\u5408\u5E76' };
        } else {
          const r = await fetch('/api/reports/' + encodeURIComponent(this.selectedWt) + '/merge-check');
          this.mergeCheckData = await r.json();
        }
      } catch {}
    },

    statusBadges(data) {
      if (!data) return '';
      let b = '';
      if (data.staged > 0) b += '<span class="wt-badge staged">' + data.staged + ' staged</span>';
      if (data.unstaged > 0) b += '<span class="wt-badge dirty">' + data.unstaged + ' modified</span>';
      if (data.untracked > 0) b += '<span class="wt-badge untracked">' + data.untracked + ' untracked</span>';
      if (data.staged === 0 && data.unstaged === 0 && data.untracked === 0)
        b += '<span class="wt-badge clean">Clean</span>';
      if (data.ahead > 0) b += '<span class="wt-badge ahead">\u2191' + data.ahead + ' ahead</span>';
      if (data.behind > 0) b += '<span class="wt-badge behind">\u2193' + data.behind + ' behind</span>';
      return b;
    },

    isDirty(s) {
      return s && (s.staged > 0 || s.unstaged > 0 || s.untracked > 0);
    },

    get canMerge() {
      if (!this.mergeCheckData) return false;
      if (this.mergeState === 'success') return false;
      return this.mergeCheckData.status === 'clean';
    },

    get showSync() {
      if (!this.mergeCheckData) return false;
      return this.mergeCheckData.status === 'behind';
    },

    get mergeCheckClass() {
      if (!this.mergeCheckData) return 'merge-check checking';
      const s = this.mergeCheckData.status;
      if (s === 'clean' || s === 'merged' || s === 'up_to_date') return 'merge-check clean';
      if (s === 'conflict') return 'merge-check conflict';
      if (s === 'behind') return 'merge-check behind';
      return 'merge-check checking';
    },

    get mergeCheckMessage() {
      if (!this.mergeCheckData) return 'Checking...';
      if (this.isDirty(this.statusData?.current))
        return '\u26A0\uFE0F \u5F53\u524D\u5DE5\u4F5C\u533A\u6709\u672A\u63D0\u4EA4\u53D8\u66F4';
      if (this.isDirty(this.statusData?.upstream))
        return '\u26A0\uFE0F \u4E0A\u6E38\u6709\u672A\u63D0\u4EA4\u53D8\u66F4';
      if (this.mergeCheckData.status === 'behind')
        return '\u26A0\uFE0F ' + this.mergeCheckData.message + '\uFF0C\u70B9\u51FB Sync \u540C\u6B65\u4E0A\u6E38';
      if (this.mergeCheckData.status === 'conflict')
        return '\u274C \u68C0\u6D4B\u5230\u5408\u5E76\u51B2\u7A81\uFF0C\u8BF7\u6267\u884C /resolve-conflicts \u89E3\u51B3';
      return this.mergeCheckData.message || '';
    },

    async doSync(terminal) {
      this.syncState = 'running';
      const ok = await terminal.run(
        '/api/reports/' + encodeURIComponent(this.selectedWt) + '/sync'
      );
      this.syncState = ok ? 'success' : 'failed';
      if (ok) this.refreshActions();
    },

    async doMerge(terminal) {
      this.mergeState = 'running';
      const ok = await terminal.run(
        '/api/reports/' + encodeURIComponent(this.selectedWt) + '/merge'
      );
      this.mergeState = ok ? 'success' : 'failed';
      if (ok) this.refreshActions();
    },
  }));
});
