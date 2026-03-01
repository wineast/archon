/* ── Archon Admin — Alpine Init + SSE ──────────────────────── */

// SSE connection
function connectSSE() {
  const es = new EventSource('/api/events');
  es.onmessage = function (e) {
    try {
      const msg = JSON.parse(e.data);
      window.dispatchEvent(new CustomEvent('sse-message', { detail: msg }));
    } catch {}
  };
  es.onerror = function () {
    es.close();
    setTimeout(connectSSE, 3000);
  };
}

// Shared escape helper
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Start SSE on load
document.addEventListener('DOMContentLoaded', connectSSE);
