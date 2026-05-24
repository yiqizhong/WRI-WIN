import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { bootstrapDocumentChrome } from "./bootstrap-document";
import "./index.css";

bootstrapDocumentChrome();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
