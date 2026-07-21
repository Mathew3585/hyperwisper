import React from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "@/windows/overlay/OverlayApp";
import { I18nProvider } from "@/i18n";
import "@/styles/globals.css";

document.body.classList.add("overlay");

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// The overlay is a separate webview, so it reads the stored locale itself —
// it shares localStorage with the settings window, which is how a language
// change there reaches the pill here.
createRoot(root).render(
  <React.StrictMode>
    <I18nProvider>
      <OverlayApp />
    </I18nProvider>
  </React.StrictMode>
);
