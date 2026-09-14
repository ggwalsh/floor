import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import { FloorApp } from "./App";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <FloorApp homeHref="./index.html" />
  </StrictMode>,
);
