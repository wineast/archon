/* ── Shared Terminal Component ─────────────────────────────── */

document.addEventListener('alpine:init', () => {
  Alpine.data('terminal', () => ({
    visible: false,
    lines: [],

    appendLine(text, cls) {
      this.lines.push({ text, cls });
      this.$nextTick(() => {
        const el = this.$refs.termContent;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    async run(url) {
      this.visible = true;
      this.lines = [];

      return new Promise((resolve) => {
        fetch(url, { method: 'POST' }).then((res) => {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          const read = () => {
            reader.read().then((result) => {
              if (result.done) {
                resolve();
                return;
              }
              buf += decoder.decode(result.value, { stream: true });
              const parts = buf.split('\n\n');
              buf = parts.pop();
              for (const part of parts) {
                const line = part.replace(/^data: /, '');
                if (!line) continue;
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'stdout') this.appendLine(msg.data, 'stdout');
                  else if (msg.type === 'stderr') this.appendLine(msg.data, 'stderr');
                  else if (msg.type === 'exit') {
                    if (msg.data === 0) {
                      this.appendLine('\nDone (exit 0)', 'exit-success');
                    } else {
                      this.appendLine('\nFailed (exit ' + msg.data + ')', 'exit-fail');
                    }
                    resolve(msg.data === 0);
                  } else if (msg.type === 'error') {
                    this.appendLine('Error: ' + msg.data, 'stderr');
                    resolve(false);
                  }
                } catch {}
              }
              read();
            });
          };
          read();
        });
      });
    },

    close() {
      this.visible = false;
      this.lines = [];
    },
  }));
});
