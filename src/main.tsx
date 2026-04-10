import "./style.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

const appRoot = createRoot(root);

appRoot.render(<App />);
