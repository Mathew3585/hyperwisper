import { toast } from "sonner";
import { getDictionary } from "@/i18n";
import { events } from "./events";

/**
 * No hooks here: this module is wired from module scope, outside React. Read
 * the dictionary inside each handler rather than once at import time, so a
 * language change applies to the very next toast.
 */
const t = () => getDictionary().toast;

/**
 * Subscribe once at app startup to every error-style event the Rust backend
 * emits. The settings window is the only one running this — the overlay's
 * pill has no room for toasts, so backend-side OS notifications cover the
 * "settings closed" case.
 *
 * Backend `err`/`msg` payloads are passed through untranslated: they are raw
 * system messages, not UI copy.
 */
export async function wireGlobalToasts() {
  events.onPasteError((err) => {
    toast.warning(t().pasteFailed.title, {
      description: t().pasteFailed.description,
    });
    console.warn("paste:error", err);
  });

  events.onHotkeyConflict((combo) => {
    toast.error(t().hotkeyConflict.title, {
      description: combo
        ? t().hotkeyConflict.withCombo(combo)
        : t().hotkeyConflict.generic,
      duration: 8000,
    });
  });

  events.onDeviceDisconnect(() => {
    toast.error(t().deviceDisconnect.title, {
      description: t().deviceDisconnect.description,
    });
  });

  events.onModelLoadError((err) => {
    toast.error(t().modelLoadError.title, { description: err });
  });

  events.onRecordingError((msg) => {
    toast.error(t().recordingError.title, { description: msg });
  });

  events.onRecordingNoVoice(() => {
    toast.message(t().noVoice.title, {
      description: t().noVoice.description,
    });
  });
}
