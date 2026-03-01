import { createRoot } from "react-dom/client";
import { SSEProvider } from "./hooks/use-sse";
import { TasksPanel } from "./panels/TasksPanel";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <SSEProvider>
    <TasksPanel />
  </SSEProvider>
);
