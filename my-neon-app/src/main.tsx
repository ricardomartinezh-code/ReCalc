import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StackProvider } from "@stackframe/react";
import "./index.css";
import App from "./App";
import { stackClientApp } from "./stack/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StackProvider app={stackClientApp}>
        <App />
      </StackProvider>
    </BrowserRouter>
  </StrictMode>,
)
