import { createRoot } from "react-dom/client";
import { TasksPanel } from "./panels/TasksPanel";
import "./style.css";

createRoot(document.getElementById("root")!).render(<TasksPanel />);
