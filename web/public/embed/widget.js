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

  // Determine the origin of the script (for iframe src)
  var scriptSrc = script.getAttribute("src") || "";
  var origin = "";
  try {
    origin = new URL(scriptSrc, window.location.href).origin;
  } catch (e) {
    origin = window.location.origin;
  }

  var iframeUrl =
    origin + "/embed/" + encodeURIComponent(agentId) + "?token=" + encodeURIComponent(token);

  // Configurable options
  var position = script.getAttribute("data-position") || "bottom-right";
  var buttonColor = script.getAttribute("data-button-color") || "#6366f1";
  var buttonSize = script.getAttribute("data-button-size") || "56";
  var widgetWidth = script.getAttribute("data-width") || "400";
  var widgetHeight = script.getAttribute("data-height") || "600";

  var btnSizePx = parseInt(buttonSize, 10);
  var isOpen = false;

  // Create container
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
    "width:" + btnSizePx + "px;height:" + btnSizePx + "px;" +
    "border-radius:50%;border:none;cursor:pointer;" +
    "background:" + buttonColor + ";color:#fff;" +
    "display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.15);" +
    "transition:transform 0.2s,box-shadow 0.2s;";
  button.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
    "</svg>";

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
    "width:" + widgetWidth + "px;height:" + widgetHeight + "px;" +
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

  // Toggle
  button.addEventListener("click", function () {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? "block" : "none";
    button.innerHTML = isOpen
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    button.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
  });

  container.appendChild(chatWindow);
  container.appendChild(button);
  document.body.appendChild(container);
})();
