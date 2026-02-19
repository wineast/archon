(function () {
  "use strict";

  // Find the script tag that loaded us
  var scripts = document.querySelectorAll("script[data-agent-id]");
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var agentId = script.getAttribute("data-agent-id");
  var token = script.getAttribute("data-token");
  if (!agentId || !token) {
    console.error("[archon-widget] data-agent-id and data-token are required");
    return;
  }

  // Determine the origin of the script (for iframe src + origin validation)
  var scriptSrc = script.getAttribute("src") || "";
  var origin = "";
  try {
    origin = new URL(scriptSrc, window.location.href).origin;
  } catch (e) {
    origin = window.location.origin;
  }

  var iframeUrl =
    origin +
    "/embed/" +
    encodeURIComponent(agentId) +
    "?token=" +
    encodeURIComponent(token);

  // Configurable options
  var position = script.getAttribute("data-position") || "bottom-right";
  var buttonColor = script.getAttribute("data-button-color") || "#6366f1";
  var buttonSize = script.getAttribute("data-button-size") || "56";
  var widgetWidth = script.getAttribute("data-width") || "400";
  var widgetHeight = script.getAttribute("data-height") || "600";

  var btnSizePx = parseInt(buttonSize, 10);
  var isOpen = false;

  // ─── Communication state ───

  var iframeReady = false;
  var messageQueue = [];
  var hostContext = {};
  var toolHandlers = {};
  var eventListeners = {};

  // ─── Helpers ───

  function sendToIframe(msg) {
    if (!iframe || !iframe.contentWindow) return;
    if (!iframeReady) {
      messageQueue.push(msg);
      return;
    }
    iframe.contentWindow.postMessage(msg, origin);
  }

  function flushQueue() {
    for (var i = 0; i < messageQueue.length; i++) {
      iframe.contentWindow.postMessage(messageQueue[i], origin);
    }
    messageQueue = [];
  }

  function emit(event, data) {
    var listeners = eventListeners[event];
    if (!listeners) return;
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](data);
      } catch (e) {
        console.error("[archon-widget] event listener error:", e);
      }
    }
  }

  // ─── UI: Create container ───

  var container = document.createElement("div");
  container.id = "archon-widget-container";
  container.style.cssText =
    "position:fixed;z-index:2147483647;" +
    (position.indexOf("left") >= 0 ? "left:20px;" : "right:20px;") +
    (position.indexOf("top") >= 0 ? "top:20px;" : "bottom:20px;") +
    "font-family:system-ui,-apple-system,sans-serif;";

  // Create bubble button
  var button = document.createElement("button");
  button.id = "archon-widget-button";
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText =
    "width:" +
    btnSizePx +
    "px;height:" +
    btnSizePx +
    "px;" +
    "border-radius:50%;border:none;cursor:pointer;" +
    "background:" +
    buttonColor +
    ";color:#fff;" +
    "display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.15);" +
    "transition:transform 0.2s,box-shadow 0.2s;";

  var chatSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
    "</svg>";
  var closeSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  button.innerHTML = chatSvg;

  button.addEventListener("mouseenter", function () {
    button.style.transform = "scale(1.1)";
    button.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
  });
  button.addEventListener("mouseleave", function () {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  });

  // Create chat window
  var chatWindow = document.createElement("div");
  chatWindow.id = "archon-widget-window";
  chatWindow.style.cssText =
    "display:none;position:absolute;" +
    (position.indexOf("top") >= 0
      ? "top:" + (btnSizePx + 12) + "px;"
      : "bottom:" + (btnSizePx + 12) + "px;") +
    (position.indexOf("left") >= 0 ? "left:0;" : "right:0;") +
    "width:" +
    widgetWidth +
    "px;height:" +
    widgetHeight +
    "px;" +
    "border-radius:12px;overflow:hidden;" +
    "box-shadow:0 8px 32px rgba(0,0,0,0.15);" +
    "border:1px solid rgba(0,0,0,0.1);" +
    "background:#fff;";

  // Create iframe
  var iframe = document.createElement("iframe");
  iframe.src = iframeUrl;
  iframe.style.cssText = "width:100%;height:100%;border:none;";
  iframe.setAttribute("allow", "clipboard-write");

  chatWindow.appendChild(iframe);

  // ─── Open / Close ───

  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    chatWindow.style.display = "block";
    button.innerHTML = closeSvg;
    button.setAttribute("aria-label", "Close chat");
    emit("open");
  }

  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    chatWindow.style.display = "none";
    button.innerHTML = chatSvg;
    button.setAttribute("aria-label", "Open chat");
    emit("close");
  }

  button.addEventListener("click", function () {
    if (isOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  });

  // ─── postMessage listener (from iframe) ───

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || typeof data.type !== "string") return;

    switch (data.type) {
      case "archon:ready":
        iframeReady = true;
        flushQueue();
        // Send current context & tools on ready
        if (Object.keys(hostContext).length > 0) {
          sendToIframe({ type: "archon:context", payload: hostContext });
        }
        var toolNames = Object.keys(toolHandlers);
        if (toolNames.length > 0) {
          sendToIframe({
            type: "archon:tools-register",
            payload: toolNames,
          });
        }
        emit("ready");
        break;

      case "archon:tool-call":
        handleToolCall(data.payload);
        break;

      case "archon:message":
        emit("message", data.payload);
        break;
    }
  });

  function handleToolCall(payload) {
    var callId = payload.callId;
    var toolName = payload.toolName;
    var args = payload.args;

    var handler = toolHandlers[toolName];
    if (!handler) {
      sendToIframe({
        type: "archon:tool-error",
        payload: {
          callId: callId,
          error: 'No handler registered for tool "' + toolName + '"',
        },
      });
      return;
    }

    // 30s timeout
    var timedOut = false;
    var timeoutId = setTimeout(function () {
      timedOut = true;
      sendToIframe({
        type: "archon:tool-error",
        payload: {
          callId: callId,
          error: 'Tool "' + toolName + '" execution timed out (30s)',
        },
      });
    }, 30000);

    try {
      var result = handler(args);
      // Support both sync and async handlers
      if (result && typeof result.then === "function") {
        result.then(
          function (res) {
            if (timedOut) return;
            clearTimeout(timeoutId);
            sendToIframe({
              type: "archon:tool-result",
              payload: { callId: callId, result: res },
            });
          },
          function (err) {
            if (timedOut) return;
            clearTimeout(timeoutId);
            sendToIframe({
              type: "archon:tool-error",
              payload: {
                callId: callId,
                error: err && err.message ? err.message : String(err),
              },
            });
          }
        );
      } else {
        if (!timedOut) {
          clearTimeout(timeoutId);
          sendToIframe({
            type: "archon:tool-result",
            payload: { callId: callId, result: result },
          });
        }
      }
    } catch (err) {
      if (!timedOut) {
        clearTimeout(timeoutId);
        sendToIframe({
          type: "archon:tool-error",
          payload: {
            callId: callId,
            error: err && err.message ? err.message : String(err),
          },
        });
      }
    }
  }

  // ─── Mount DOM ───

  container.appendChild(chatWindow);
  container.appendChild(button);
  document.body.appendChild(container);

  // ─── ArchonEmbed global API ───

  window.ArchonEmbed = {
    /** Merge host page context data (available as {{ host.* }} in templates). */
    setContext: function (data) {
      if (!data || typeof data !== "object") return;
      // Shallow merge
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          hostContext[key] = data[key];
        }
      }
      // 10KB check
      var size = new TextEncoder().encode(JSON.stringify(hostContext)).length;
      if (size > 10240) {
        console.warn(
          "[archon-widget] hostContext exceeds 10KB (" + size + " bytes)"
        );
      }
      sendToIframe({ type: "archon:context", payload: hostContext });
    },

    /** Register tool handlers that the AI can invoke. */
    registerTools: function (handlers) {
      if (!handlers || typeof handlers !== "object") return;
      for (var name in handlers) {
        if (Object.prototype.hasOwnProperty.call(handlers, name)) {
          toolHandlers[name] = handlers[name];
        }
      }
      sendToIframe({
        type: "archon:tools-register",
        payload: Object.keys(toolHandlers),
      });
    },

    /** Listen to widget events: ready, message, open, close. */
    on: function (event, cb) {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(cb);
    },

    /** Open the chat window. */
    open: openWidget,

    /** Close the chat window. */
    close: closeWidget,
  };
})();
