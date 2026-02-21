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
  var buttonColor = script.getAttribute("data-button-color") || "";
  var buttonSize = script.getAttribute("data-button-size") || "48";
  var widgetWidth = script.getAttribute("data-width") || "380";
  var widgetHeight = script.getAttribute("data-height") || "560";

  var btnSizePx = parseInt(buttonSize, 10);
  var isOpen = false;
  var EDGE_GAP = 16;
  var DRAG_THRESHOLD = 5;

  // ─── Communication state ───

  var iframeReady = false;
  var messageQueue = [];
  var hostContext = {};
  var toolHandlers = {};
  var eventListeners = {};

  // ─── Drag state ───

  var isDragging = false;
  var hasDragged = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragOffsetX = 0;
  var dragOffsetY = 0;

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

  // ─── Position helpers ───

  /** Calculate left/top coords for a given corner name */
  function getCornerCoords(corner) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = corner.indexOf("left") >= 0 ? EDGE_GAP : vw - btnSizePx - EDGE_GAP;
    var top = corner.indexOf("top") >= 0 ? EDGE_GAP : vh - btnSizePx - EDGE_GAP;
    return { left: left, top: top };
  }

  /** Find nearest corner from a left/top position */
  function getNearestCorner(left, top) {
    var cx = left + btnSizePx / 2;
    var cy = top + btnSizePx / 2;
    var corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
    var best = corners[0];
    var bestDist = Infinity;
    for (var i = 0; i < corners.length; i++) {
      var c = getCornerCoords(corners[i]);
      var dx = cx - (c.left + btnSizePx / 2);
      var dy = cy - (c.top + btnSizePx / 2);
      var dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = corners[i];
      }
    }
    return best;
  }

  /** Update chat window positioning based on current position */
  function updateChatWindowPosition() {
    var isTop = position.indexOf("top") >= 0;
    var isLeft = position.indexOf("left") >= 0;
    chatWindow.style.top = isTop ? (btnSizePx + 12) + "px" : "auto";
    chatWindow.style.bottom = isTop ? "auto" : (btnSizePx + 12) + "px";
    chatWindow.style.left = isLeft ? "0" : "auto";
    chatWindow.style.right = isLeft ? "auto" : "0";
  }

  /** Snap container to corner with animation */
  function snapToCorner(corner) {
    position = corner;
    var coords = getCornerCoords(corner);
    container.style.transition = "left 0.3s ease-out, top 0.3s ease-out";
    container.style.left = coords.left + "px";
    container.style.top = coords.top + "px";
    updateChatWindowPosition();
    setTimeout(function () {
      container.style.transition = "";
    }, 300);
  }

  // ─── Styles (CSS variables with fallbacks for external sites) ───

  var btnBg = buttonColor || "var(--primary, #18181b)";
  var btnFg = "var(--primary-foreground, #fafafa)";
  var winBg = "var(--background, #ffffff)";
  var winBorder = "var(--border, #e4e4e7)";

  // ─── UI: Create container ───

  var initCoords = getCornerCoords(position);
  var container = document.createElement("div");
  container.id = "archon-widget-container";
  container.style.cssText =
    "position:fixed;z-index:2147483647;" +
    "left:" + initCoords.left + "px;" +
    "top:" + initCoords.top + "px;" +
    "font-family:system-ui,-apple-system,sans-serif;";

  // Create bubble button
  var button = document.createElement("button");
  button.id = "archon-widget-button";
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText =
    "width:" + btnSizePx + "px;" +
    "height:" + btnSizePx + "px;" +
    "border-radius:50%;border:none;cursor:pointer;" +
    "background:" + btnBg + ";" +
    "color:" + btnFg + ";" +
    "display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1);" +
    "transition:opacity 0.15s ease,box-shadow 0.15s ease,transform 0.15s ease;" +
    "touch-action:none;user-select:none;-webkit-user-select:none;";

  var iconSize = Math.round(btnSizePx * 0.42);
  var chatSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + iconSize + '" height="' + iconSize + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
    "</svg>";
  var closeSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + iconSize + '" height="' + iconSize + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  button.innerHTML = chatSvg;

  button.addEventListener("mouseenter", function () {
    if (!isDragging) {
      button.style.opacity = "0.9";
      button.style.boxShadow =
        "0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1)";
    }
  });
  button.addEventListener("mouseleave", function () {
    if (!isDragging) {
      button.style.opacity = "1";
      button.style.boxShadow =
        "0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)";
    }
  });

  // Create chat window
  var chatWindow = document.createElement("div");
  chatWindow.id = "archon-widget-window";
  chatWindow.style.cssText =
    "position:absolute;" +
    (position.indexOf("top") >= 0
      ? "top:" + (btnSizePx + 12) + "px;"
      : "bottom:" + (btnSizePx + 12) + "px;") +
    (position.indexOf("left") >= 0 ? "left:0;" : "right:0;") +
    "width:" + widgetWidth + "px;" +
    "height:" + widgetHeight + "px;" +
    "border-radius:var(--radius-xl, 12px);" +
    "overflow:hidden;" +
    "box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);" +
    "border:1px solid " + winBorder + ";" +
    "background:" + winBg + ";" +
    "opacity:0;transform:translateY(8px) scale(0.98);" +
    "pointer-events:none;" +
    "transition:opacity 0.2s ease,transform 0.2s ease;";

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
    chatWindow.style.opacity = "1";
    chatWindow.style.transform = "translateY(0) scale(1)";
    chatWindow.style.pointerEvents = "auto";
    button.innerHTML = closeSvg;
    button.setAttribute("aria-label", "Close chat");
    emit("open");
  }

  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    chatWindow.style.opacity = "0";
    chatWindow.style.transform = "translateY(8px) scale(0.98)";
    chatWindow.style.pointerEvents = "none";
    button.innerHTML = chatSvg;
    button.setAttribute("aria-label", "Open chat");
    emit("close");
  }

  // ─── Drag handling ───

  function getClientPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onDragStart(e) {
    if (e.type === "mousedown" && e.button !== 0) return;

    var pos = getClientPos(e);
    dragStartX = pos.x;
    dragStartY = pos.y;

    var rect = container.getBoundingClientRect();
    dragOffsetX = pos.x - rect.left;
    dragOffsetY = pos.y - rect.top;

    hasDragged = false;
    isDragging = false;

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend", onDragEnd);
    document.addEventListener("touchcancel", onDragEnd);
  }

  function onDragMove(e) {
    var pos = getClientPos(e);
    var dx = pos.x - dragStartX;
    var dy = pos.y - dragStartY;

    if (!hasDragged && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) {
      return;
    }

    if (!hasDragged) {
      hasDragged = true;
      isDragging = true;
      if (isOpen) closeWidget();
      // Drag visual feedback
      button.style.transform = "scale(1.05)";
      button.style.boxShadow =
        "0 10px 25px -5px rgba(0,0,0,0.2),0 8px 10px -6px rgba(0,0,0,0.15)";
      button.style.cursor = "grabbing";
      container.style.transition = "";
    }

    e.preventDefault();

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var newLeft = Math.max(0, Math.min(pos.x - dragOffsetX, vw - btnSizePx));
    var newTop = Math.max(0, Math.min(pos.y - dragOffsetY, vh - btnSizePx));

    container.style.left = newLeft + "px";
    container.style.top = newTop + "px";
  }

  function onDragEnd() {
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
    document.removeEventListener("touchcancel", onDragEnd);

    if (hasDragged) {
      // Reset drag visual feedback
      button.style.transform = "";
      button.style.cursor = "pointer";
      button.style.boxShadow =
        "0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)";
      button.style.opacity = "1";

      // Snap to nearest corner
      var rect = container.getBoundingClientRect();
      var nearest = getNearestCorner(rect.left, rect.top);
      snapToCorner(nearest);

      // Reset hasDragged after click event fires (prevents toggle on drag end)
      setTimeout(function () {
        hasDragged = false;
        isDragging = false;
      }, 0);
    } else {
      isDragging = false;
    }
  }

  button.addEventListener("mousedown", onDragStart);
  button.addEventListener("touchstart", onDragStart, { passive: true });

  button.addEventListener("click", function () {
    if (hasDragged) return;
    if (isOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  });

  // ─── Resize handler ───

  window.addEventListener("resize", function () {
    var rect = container.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (
      rect.left < 0 ||
      rect.top < 0 ||
      rect.left + btnSizePx > vw ||
      rect.top + btnSizePx > vh
    ) {
      var clamped = getNearestCorner(
        Math.max(0, Math.min(rect.left, vw - btnSizePx)),
        Math.max(0, Math.min(rect.top, vh - btnSizePx))
      );
      snapToCorner(clamped);
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
