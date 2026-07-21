import type { Dictionary } from "..";

/**
 * Français — la langue d'origine de l'application.
 *
 * Ces chaînes sont celles écrites en premier, récupérées telles quelles depuis
 * les composants. Les variantes proches (« pendant que tu parles » vs « tant
 * que tu parles ») sont volontairement conservées : chaque écran garde sa
 * formulation.
 *
 * Registre : tutoiement, ton direct.
 */
export const fr: Dictionary = {
  common: {
    loading: "Chargement…",
    saving: "Sauvegarde…",
    save: "Enregistrer",
    cancel: "Annuler",
    edit: "Modifier",
    delete: "Supprimer",
    copy: "Copier",
    next: "Suivant",
    back: "Retour",
    close: "Fermer",
    retry: "Réessayer",
    continue: "Continuer",
    unknownError: "Erreur inconnue",
    none: "Aucun",
  },

  window: {
    minimize: "Réduire",
    maximize: "Agrandir",
    close: "Fermer",
  },

  nav: {
    general: "Général",
    models: "Modèles",
    audio: "Audio",
    shortcuts: "Raccourcis",
    history: "Historique",
    about: "À propos",
  },

  sidebar: {
    navAriaLabel: "Sections des paramètres",
    accountAriaLabel: "Ouvrir le compte",
    accountLabel: "Compte",
  },

  topbar: {
    ariaLabel: "Barre de titre",
    theme: {
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      groupAriaLabel: "Thème",
    },
  },

  time: {
    justNow: "à l'instant",
    minutesAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n} h`,
  },

  units: {
    seconds: (s: number) => `${s}s`,
    minutesSeconds: (m: number, s: number) => `${m}m ${s}s`,
    hours: (h: number) => `${h}h`,
    minutesLong: (m: number) => `${m} min`,
    hoursLong: (h: number) => `${h} h`,
    megabytes: (mb: number | string) => `${mb} MB`,
    kilobytes: (kb: string) => `${kb} KB`,
    bytes: (b: number) => `${b} B`,
    audioSeconds: (sec: string) => `${sec}s audio`,
  },

  toast: {
    pasteFailed: {
      title: "Collage automatique impossible",
      description: "Le texte est dans ton presse-papier — colle-le avec Ctrl+V.",
    },
    hotkeyConflict: {
      title: "Raccourci déjà utilisé",
      withCombo: (combo: string) =>
        `« ${combo} » est capturé par une autre app. Change-le dans Raccourcis.`,
      generic:
        "Une autre application a déjà capturé ce raccourci. Change-le dans Raccourcis.",
    },
    deviceDisconnect: {
      title: "Microphone déconnecté",
      description: "L'enregistrement en cours a été annulé.",
    },
    modelLoadError: { title: "Modèle illisible" },
    recordingError: { title: "Transcription échouée" },
    noVoice: {
      title: "Aucune voix détectée",
      description:
        "L'enregistrement n'a capturé que du silence — rien n'a été collé.",
    },
  },

  overlay: {
    transcribing: "Transcription",
    done: "Collé",
    cancelTitle: "Annuler (Esc)",
    cancelAriaLabel: "Annuler la dictée",
  },

  systemStatus: {
    whisper: {
      label: "Modèle Whisper",
      loaded: (model: string) => model,
      missing: "Aucun modèle chargé",
    },
    microphone: {
      label: "Microphone",
      ok: (device: string) => device,
      missing: "Aucun micro détecté",
    },
    hotkey: {
      label: "Raccourci",
      ok: (combo: string) => combo,
    },
    acceleration: {
      label: "Accélération",
      gpu: (name: string) => `${name} · GPU actif`,
      cpuWithGpu: (name: string) => `CPU uniquement · ${name} disponible`,
      cpu: "CPU",
    },
    privacy: {
      label: "Confidentialité",
      ok: "100% local · aucune requête sortante",
    },
  },

  tray: {
    open: "Ouvrir Hyperwisper",
    status: (combo: string) => `À l'écoute — ${combo}`,
    quit: "Quitter",
    tooltip: "Hyperwisper — la voix en texte",
  },

  settings: {
    general: {
      holdHintPrefix: "Maintiens",
      holdHintSuffix: "n'importe où dans Windows",
      todayLabel: "Aujourd'hui",
      stat: { dictations: "Dictées", words: "Mots", audio: "Audio" },
      systemLabel: "Système",
      recentTitle: "Dernières dictées",
      seeAll: "Voir tout",
      wordCount: (n: number) => (n > 1 ? `${n} mots` : `${n} mot`),
      hero: {
        loading: {
          title: "Initialisation…",
          subtitle: "Vérification du système en cours.",
        },
        noModel: {
          title: "Un modèle à télécharger.",
          subtitle:
            "Aucun modèle Whisper n'est encore chargé. Va dans Modèles pour en récupérer un.",
        },
        noMic: {
          title: "Microphone introuvable.",
          subtitle:
            "Aucun périphérique d'entrée audio n'est détecté. Branche un micro ou vérifie tes paramètres Windows.",
        },
        setup: {
          title: "Setup à finaliser.",
          subtitle: "Quelques vérifications à régler avant de pouvoir dicter.",
        },
        ready: {
          title: "Tout est prêt.",
          subtitle:
            "Hyperwisper écoute en arrière-plan. Le texte est collé là où ton curseur se trouve, immédiatement.",
        },
      },
    },

    models: {
      title: "Modèles",
      description:
        "Choisis un modèle Whisper. Tout reste sur ton PC — aucun audio ne quitte la machine.",
      storageLabel: "Stockage",
      state: { active: "Actif" },
      action: {
        load: "Charger",
        download: "Télécharger",
        downloading: "Téléchargement",
      },
      reco: {
        tinyQ5_1:
          "Test rapide, qualité approximative. À éviter pour le quotidien.",
        baseQ5_1:
          "Léger pour PC modeste. Acceptable pour de courtes phrases simples.",
        smallQ5_1: "★ Recommandé. Le meilleur compromis qualité/vitesse.",
        small:
          "Version non quantisée du Small. Marginalement plus précis, 2,5× plus lourd.",
        mediumQ5_0:
          "Pour les longues dictées techniques. Demande un CPU costaud.",
        largeV3Q5_0:
          "Précision maximale. Lent même avec GPU, overkill pour la dictée.",
      },
    },

    audio: {
      title: "Audio",
      description: "Choisis ton micro et la façon dont la dictée se déclenche.",
      microphoneTitle: "Microphone",
      defaultDevice: {
        label: "Périphérique système par défaut",
        sublabel: "Suit ton choix Windows automatiquement",
      },
      noDevices: "Aucun périphérique d'entrée détecté.",
      fallbackHint:
        "Si le micro choisi est débranché, Hyperwisper retombera automatiquement sur le défaut système.",
      modeTitle: "Mode d'enregistrement",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Une pression pour démarrer, une autre pour arrêter.",
        pttLabel: "Push-to-talk",
        pttDescription: "Maintiens la touche pendant que tu parles.",
      },
      overlayTitle: "Overlay",
      overlay: {
        fatLabel: "Fat",
        fatDescription:
          "Pill complet avec waveform et chrono. Présence assumée.",
        thinLabel: "Thin",
        thinDescription:
          "Sliver minimal, juste l'essentiel. Discret à l'écran.",
      },
      overlayHint: "Le changement s'applique au prochain enregistrement.",
      pasteTitle: "Collage",
      autoPaste: {
        label: "Coller automatiquement",
        description:
          "Le texte est inséré là où ton curseur est. Désactive pour juste copier dans le presse-papier.",
      },
      preserveClipboard: {
        label: "Préserver le presse-papier",
        description:
          "Restaure ce que tu avais copié avant la dictée, ~250 ms après le collage.",
      },
      startupTitle: "Démarrage",
      autoLaunch: {
        label: "Lancer au démarrage de Windows",
        description:
          "Hyperwisper se lance discrètement dans la barre des tâches dès l'ouverture de session, raccourci prêt à l'emploi.",
      },
    },

    language: {
      title: "Langue",
      description:
        "La langue de l'interface et celle dans laquelle tu dictes sont indépendantes — tu peux utiliser l'app en français et dicter dans n'importe quelle langue que Whisper gère.",
      uiLabel: "Langue de l'interface",
      uiHint: "Détectée depuis Windows au premier lancement.",
      transcriptionLabel: "Langue de dictée",
      transcriptionHint:
        "Règle-la sur la langue que tu parles réellement. La détection automatique fonctionne bien, mais nommer la langue explicitement est plus précis sur les dictées courtes.",
      autoDetect: "Détecter automatiquement",
      autoDetectSublabel: "Whisper déduit la langue de ce qu'il entend",
      wellSupportedGroup: "Les mieux gérées",
      otherGroup: "Autres langues",
      searchPlaceholder: "Rechercher une langue…",
      noResults: "Aucune langue ne correspond.",
    },

    shortcuts: {
      title: "Raccourcis",
      description:
        "La touche que tu maintiens ou presses pour démarrer une dictée.",
      mainLabel: "Raccourci principal",
      imeTip: {
        prefix: "Conseil — évite",
        middle:
          "si tu as activé un IME Windows (chinois, japonais, coréen). Essaie",
        or: "ou",
        suffix: "comme alternatives.",
      },
      modeLabel: "Mode",
      modeToggle: {
        name: "Toggle",
        description:
          "— une pression pour démarrer, une autre pour arrêter. Idéal pour les longues dictées.",
      },
      modePtt: {
        name: "Push-to-talk",
        description:
          "— maintiens la touche tant que tu parles, relâche pour stopper. Idéal pour les phrases courtes.",
      },
      changeModeHintPrefix: "Pour changer de mode, va dans l'onglet",
      changeModeHintSuffix: ".",
      editor: {
        capturing: "Appuie sur ta combinaison…",
        escHintSuffix: "pour annuler",
        modeHintPrefix: "En mode",
        modeHintToggle:
          ", appuie une fois pour démarrer et une fois pour arrêter.",
        modeHintPtt: ", maintiens la touche pendant que tu parles.",
      },
    },

    history: {
      title: "Historique",
      description:
        "Toutes tes dictées sont stockées localement. Clique sur une entrée pour la recopier.",
      clearConfirm: "Effacer tout l'historique ? Cette action est irréversible.",
      dictationCount: (n: number) => (n > 1 ? "dictées" : "dictée"),
      wordCountLabel: (n: number) => (n > 1 ? "mots" : "mot"),
      clearAll: "Tout effacer",
      editHint: "Ctrl + ↵ pour sauver · Esc pour annuler",
      entryWords: (n: number) => (n > 1 ? `${n} mots` : `${n} mot`),
      empty: {
        title: "Aucune dictée pour le moment",
        descriptionPrefix: "Appuie sur",
        descriptionSuffix:
          "n'importe où dans Windows et parle. Tes dictées apparaîtront ici.",
      },
    },

    account: {
      title: "Compte",
      description: "Ton activité et ton setup.",
      heroTitle: "Tout est inclus.",
      heroBody:
        "Hyperwisper est gratuit et open-source. Aucune fonctionnalité n'est verrouillée, aucun abonnement.",
      included: [
        "Dictée illimitée, sans abonnement",
        "Tous les modèles Whisper accessibles",
        "Transcription 100% locale (offline)",
        "Auto-paste là où ton curseur est",
        "Historique complet, recherche, export",
        "Accélération GPU (Vulkan) embarquée",
      ],
      totalsLabel: "Activité totale",
      stat: {
        dictations: "Dictées",
        words: "Mots transcrits",
        audio: "Audio capturé",
      },
      setupLabel: "Setup actuel",
      rowActiveModel: "Modèle actif",
      rowVersion: "Version",
    },

    about: {
      tagline:
        "Dictée vocale instantanée. Ta voix devient texte, partout dans Windows. Rien ne sort de ton ordinateur.",
      whyLabel: "Pourquoi",
      why: {
        p1Prefix: "Parce que",
        p1Emphasis: "parler",
        p1Suffix:
          "est 3× plus rapide qu'écrire au clavier. Tes idées sortent à la vitesse à laquelle tu les penses. Plus d'allers-retours mentaux entre la phrase et les doigts.",
        p2: "Parce que les alternatives existantes te demandent un abonnement mensuel pour utiliser une technologie open-source. Hyperwisper, c'est le même résultat, sans abonnement, sans cloud, sans compromis.",
      },
      howLabel: "Comment ça marche",
      step1: {
        titlePrefix: "Tu appuies sur",
        description:
          "N'importe où dans Windows. Sur ton bureau, dans Discord, dans Word, dans ton terminal. La pill apparaît en haut de l'écran.",
      },
      step2: {
        title: "Tu parles",
        descriptionPrefix:
          "Hyperwisper écoute et visualise ton audio en temps réel. Re-appuie sur",
        descriptionSuffix: "quand tu as fini.",
      },
      step3: {
        title: "Ton texte se colle",
        description:
          "La transcription est faite sur ton PC en quelques secondes, puis collée exactement où ton curseur se trouve. Comme si tu l'avais tapée.",
      },
      privacyLabel: "Confidentialité",
      privacyBody:
        "Aucun audio n'est envoyé sur internet. Aucun texte transcrit n'est partagé. Aucune statistique d'usage n'est collectée. Tout reste sur ta machine, pour toujours.",
      dangerLabel: "Zone de danger",
      uninstall: {
        title: "Désinstaller Hyperwisper",
        description:
          "Supprime l'application, le modèle, tes réglages et ton historique. Tu verras un écran de confirmation avant.",
        button: "Désinstaller…",
        launching: "Lancement…",
      },
      credit: "Made by mathew · 2026",
    },
  },

  onboarding: {
    stepEyebrow: "Étape",
    welcome: {
      title: "Bienvenue dans Hyperwisper.",
      body:
        "La dictée vocale instantanée pour Windows. Tu parles, le texte se colle là où ton curseur est. Tout reste sur ton PC.",
      bullet1: "100% local — aucun audio ne quitte ta machine",
      bullet2: "Gratuit pour toujours, open-source",
      bullet3: "Trois minutes pour configurer, c'est parti",
      cta: "Commencer",
    },
    mic: {
      title: "Ton microphone",
      description:
        "Choisis le micro qu'Hyperwisper doit écouter, puis fais un test rapide.",
      deviceLabel: "Microphone",
      defaultDevice: {
        label: "Périphérique système par défaut",
        sublabel: "Suit ton choix Windows",
      },
      noDevices: "Aucun autre micro détecté.",
      testLabel: (seconds: number) => `Test (${seconds} secondes)`,
      listening: "Écoute…",
      testButton: "Tester",
      retestButton: "Refaire",
      soundDetected: "Son détecté",
      testHint: (seconds: number) =>
        `Parle normalement pendant ${seconds} secondes. La barre devrait s'animer. Si elle reste plate, change de micro au-dessus.`,
      nextHint: "Fais un test avant de continuer",
    },
    model: {
      title: "Le modèle de transcription",
      description:
        "Whisper Small offre le meilleur compromis qualité / vitesse. Tu peux en essayer d'autres plus tard dans Modèles.",
      sizeAndEta: (sizeMb: number) =>
        `${sizeMb} MB · environ 1 minute à télécharger`,
      unavailable: "Indisponible",
      ready: "Prêt à dicter",
      storageHintPrefix: "Le fichier est stocké dans",
      storageHintSuffix:
        ". Tu peux le supprimer à tout moment depuis l'onglet Modèles.",
      skip: "Je télécharge plus tard",
      nextHint: "Modèle non chargé",
      badge: {
        active: "Actif",
        downloaded: "Téléchargé",
        toDownload: "À télécharger",
      },
      error: {
        notFound: (count: number) =>
          `Modèle introuvable dans la liste (${count} entrée${
            count > 1 ? "s" : ""
          }). Tu peux passer cette étape et le télécharger depuis l'onglet Modèles.`,
        listFailed: (err: string) =>
          `Impossible de récupérer la liste des modèles : ${err}`,
      },
    },
    hotkey: {
      title: "Comment déclencher la dictée ?",
      description:
        "Choisis ton raccourci global et le mode d'enregistrement. Tu pourras tout changer plus tard depuis Settings.",
      label: "Raccourci",
      modeLabel: "Mode",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Une pression pour démarrer, une autre pour arrêter.",
        pttLabel: "Push-to-talk",
        pttDescription: "Maintiens la touche tant que tu parles.",
      },
    },
    launch: {
      title: "Lancer au démarrage ?",
      description:
        "Hyperwisper vit dans la barre des tâches. Si tu le lances au démarrage de Windows, ton raccourci est prêt dès que tu ouvres ta session — sans rien à faire.",
      autoLabel: "Au démarrage",
      autoDescription:
        "Hyperwisper se lance automatiquement avec Windows. Recommandé.",
      manualLabel: "Manuel",
      manualDescription: "Tu lances Hyperwisper toi-même quand tu en as besoin.",
      hint:
        "Hyperwisper démarre discrètement en arrière-plan : pas de fenêtre, seulement l'icône dans la barre des tâches. Tu peux changer d'avis à tout moment depuis l'onglet Audio.",
    },
    done: {
      title: "Tu es prêt.",
      body:
        "Hyperwisper écoute en arrière-plan. Maintiens ton raccourci dans n'importe quelle app pour dicter.",
      tryNowLabel: "Essaie maintenant",
      anywhereSuffix: "n'importe où dans Windows.",
      trayHint:
        "Hyperwisper se loge dans la barre de tâches. Clic sur l'icône pour rouvrir les paramètres à tout moment.",
      cta: "Terminer",
    },
  },

  installer: {
    titlebarSubtitle: "installation",
    dirPickerTitle: "Choisis le dossier d'installation",
    pitch: {
      titleLine1: "Plus rapide",
      titleLine2: "que le clavier.",
      body:
        "Hyperwisper transforme ta voix en texte, instantanément, partout dans Windows. Tu maintiens un raccourci, tu parles, le texte se colle là où ton curseur se trouve.",
      statSpeed: "plus rapide qu'écrire",
      statLocal: "local, aucun cloud",
      statFree: "gratuit pour toujours",
      footnote: "Installation locale · Pas de droits administrateur",
      cta: "Commencer",
    },
    configure: {
      eyebrowInstall: "Installation",
      eyebrowReinstall: "Réinstallation",
      title: "Où veux-tu installer Hyperwisper ?",
      body:
        "Garde le dossier par défaut si tu n'as pas de raison particulière. Hyperwisper s'installe pour ton utilisateur uniquement — pas besoin d'admin.",
      dirLabel: "Dossier d'installation",
      dirHint: (sizeMb: number) =>
        `Le binaire et le modèle Whisper (~${sizeMb} MB) y seront copiés.`,
      resetDir: "Restaurer le défaut",
      optionsLabel: "Options",
      desktopShortcut: {
        label: "Ajouter un raccourci sur le bureau",
        description: "Un raccourci Menu Démarrer est créé dans tous les cas.",
      },
      ctaInstall: "Installer",
      ctaReinstall: "Réinstaller",
    },
    installing: {
      eyebrow: "Installation en cours",
      title: "On t'installe ça.",
      body:
        "Garde la fenêtre ouverte. Ça prend une minute, le temps de récupérer le modèle.",
    },
    stage: {
      copyLabel: "Copie des fichiers",
      copySublabel: "Dépose le binaire et enregistre l'entrée Désinstaller",
      modelLabel: "Téléchargement du modèle Whisper",
      modelSublabel: (sizeMb: number) =>
        `Modèle Small Q5_1 — environ ${sizeMb} MB`,
      modelProgress: (doneMb: string, totalMb: string, pct: string) =>
        `${doneMb} / ${totalMb} MB · ${pct}%`,
      finalizeLabel: "Création des raccourcis",
      finalizeSublabel: "Menu Démarrer · entrée dans Applications installées",
    },
    done: {
      title: "Hyperwisper est installé.",
      body:
        "Tu peux supprimer ce setup. Hyperwisper vit maintenant dans le menu Démarrer.",
      installedInLabel: "Installé dans",
      cta: "Lancer Hyperwisper",
    },
    error: {
      title: "Installation interrompue.",
      body:
        "Voici ce que le système a rapporté. Réessaie — si ça persiste, c'est probablement un antivirus qui bloque la copie ou une coupure réseau pendant le téléchargement.",
      unknown: "Erreur inconnue",
    },
  },

  uninstaller: {
    titlebarSubtitle: "désinstallation",
    closeDisabledLabel: "Fermer (indisponible pendant la désinstallation)",
    confirm: {
      title: "Désinstaller Hyperwisper ?",
      body:
        "Tout va être nettoyé proprement. Cette action est irréversible — tes dictées passées ne seront plus récupérables.",
      listLabel: "Ce qui sera supprimé",
      itemBinary: "Le binaire et le dossier d'installation",
      itemModel: (sizeMb: number) =>
        `Le modèle Whisper téléchargé (~${sizeMb} MB)`,
      itemData: "Tes réglages, ton historique, tes logs",
      itemShortcuts: "Le raccourci menu Démarrer (et bureau s'il existe)",
      itemAutolaunch: "Le lancement automatique au démarrage",
      itemRegistry: "L'entrée « Hyperwisper » dans Applications installées",
      cta: "Désinstaller",
    },
    removing: {
      eyebrow: "Désinstallation en cours",
      title: "On nettoie tout.",
      body: "Ne ferme pas la fenêtre. C'est rapide.",
    },
    stage: {
      cleanupLabel: "Suppression des fichiers et données",
      cleanupSublabel: "Réglages, historique, modèle, logs, raccourcis",
      finalizeLabel: "Nettoyage du registre Windows",
      finalizeSublabel: "Entrée Désinstaller · démarrage automatique",
    },
    done: {
      title: "Merci d'avoir essayé.",
      body:
        "Hyperwisper est désinstallé. Le dossier sera supprimé dès que la fenêtre se ferme. Si tu reviens un jour, on sera là.",
    },
    error: {
      title: "Désinstallation incomplète.",
      bodyPrefix:
        "Voici ce que le système a rapporté. Tu peux supprimer le dossier d'installation manuellement, et nettoyer la clé registre",
      bodySuffix: ".",
      unknown: "Erreur inconnue",
    },
  },
};
