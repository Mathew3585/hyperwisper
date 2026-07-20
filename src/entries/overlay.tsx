import React from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "@/windows/overlay/OverlayApp";
import "@/styles/globals.css";

document.body.classList.add("overlay");

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
