import { toast } from "sonner";
import { events } from "./events";

/**
 * Subscribe once at app startup to every error-style event the Rust backend
 * emits. The settings window is the only one running this — the overlay's
 * pill has no room for toasts, so backend-side OS notifications cover the
 * "settings closed" case.
 */
export async function wireGlobalToasts() {
  events.onPasteError((err) => {
    toast.warning("Collage automatique impossible", {
      description:
        "Le texte est dans ton presse-papier — colle-le avec Ctrl+V.",
    });
    console.warn("paste:error", err);
  });

  events.onHotkeyConflict((combo) => {
    toast.error("Raccourci déjà utilisé", {
      description: combo
        ? `« ${combo} » est capturé par une autre app. Change-le dans Raccourcis.`
        : "Une autre application a déjà capturé ce raccourci. Change-le dans Raccourcis.",
      duration: 8000,
    });
  });

  events.onDeviceDisconnect(() => {
    toast.error("Microphone déconnecté", {
      description: "L'enregistrement en cours a été annulé.",
    });
  });

  events.onModelLoadError((err) => {
    toast.error("Modèle illisible", { description: err });
  });

  events.onRecordingError((msg) => {
    toast.error("Transcription échouée", { description: msg });
  });

  events.onRecordingNoVoice(() => {
    toast.message("Aucune voix détectée", {
      description: "L'enregistrement n'a capturé que du silence — rien n'a été collé.",
    });
  });
}
