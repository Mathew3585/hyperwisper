/**
 * Deutsch (de-DE).
 *
 * Übersetzung von ./en — der Quelle der Wahrheit. Struktur, Schlüssel und
 * Funktionssignaturen sind identisch; nur die Werte sind übersetzt.
 * Durchgehend informelles „du“.
 */
import type { Dictionary } from "..";

export const de: Dictionary = {
  common: {
    loading: "Lädt …",
    saving: "Speichert …",
    save: "Speichern",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    delete: "Löschen",
    copy: "Kopieren",
    next: "Weiter",
    back: "Zurück",
    close: "Schließen",
    retry: "Wiederholen",
    continue: "Fortfahren",
    unknownError: "Unbekannter Fehler",
    none: "Keine",
  },

  window: {
    minimize: "Minimieren",
    maximize: "Maximieren",
    close: "Schließen",
  },

  nav: {
    general: "Allgemein",
    models: "Modelle",
    audio: "Audio",
    shortcuts: "Kürzel",
    history: "Verlauf",
    about: "Über",
  },

  sidebar: {
    navAriaLabel: "Bereiche der Einstellungen",
    accountAriaLabel: "Konto öffnen",
    accountLabel: "Konto",
  },

  topbar: {
    ariaLabel: "Titelleiste",
    theme: {
      light: "Hell",
      dark: "Dunkel",
      system: "System",
      groupAriaLabel: "Design",
    },
  },

  /**
   * Relative Zeitangaben. Verlauf und Übersicht nutzen dieselben Strings.
   */
  time: {
    justNow: "gerade eben",
    minutesAgo: (n: number) => `vor ${n} Min.`,
    hoursAgo: (n: number) => `vor ${n} Std.`,
  },

  units: {
    /** Kurze Audiodauer, z. B. „42s“. */
    seconds: (s: number) => `${s}s`,
    /** z. B. „3m 12s“ */
    minutesSeconds: (m: number, s: number) => `${m}m ${s}s`,
    /** z. B. „2h“ */
    hours: (h: number) => `${h}h`,
    /** Ausgeschriebene Variante im Konto-Bereich, z. B. „7 Min.“. */
    minutesLong: (m: number) => `${m} Min.`,
    hoursLong: (h: number) => `${h} Std.`,
    megabytes: (mb: number | string) => `${mb} MB`,
    kilobytes: (kb: string) => `${kb} KB`,
    bytes: (b: number) => `${b} B`,
    /** Audiolänge eines Diktats, z. B. „4.2s Audio“. */
    audioSeconds: (sec: string) => `${sec}s Audio`,
  },

  toast: {
    pasteFailed: {
      title: "Automatisches Einfügen fehlgeschlagen",
      description:
        "Der Text liegt in deiner Zwischenablage — füge ihn mit Ctrl+V ein.",
    },
    hotkeyConflict: {
      title: "Kürzel schon belegt",
      withCombo: (combo: string) =>
        `„${combo}“ wird von einer anderen App abgefangen. Ändere es unter Kürzel.`,
      generic:
        "Eine andere Anwendung belegt dieses Kürzel bereits. Ändere es unter Kürzel.",
    },
    deviceDisconnect: {
      title: "Mikrofon getrennt",
      description: "Die laufende Aufnahme wurde abgebrochen.",
    },
    modelLoadError: { title: "Modell nicht lesbar" },
    recordingError: { title: "Transkription fehlgeschlagen" },
    noVoice: {
      title: "Keine Sprache erkannt",
      description:
        "Die Aufnahme enthielt nur Stille — es wurde nichts eingefügt.",
    },
  },

  overlay: {
    transcribing: "Transkribiert",
    done: "Eingefügt",
    cancelTitle: "Abbrechen (Esc)",
    cancelAriaLabel: "Diktat abbrechen",
  },

  /**
   * Beschriftungen für das Rust-Payload `get_system_status`. Das Backend
   * liefert stabile IDs statt Fließtext, deshalb stehen die Texte hier und
   * folgen der UI-Sprache wie alles andere.
   */
  systemStatus: {
    whisper: {
      label: "Whisper-Modell",
      loaded: (model: string) => model,
      missing: "Kein Modell geladen",
    },
    microphone: {
      label: "Mikrofon",
      ok: (device: string) => device,
      missing: "Kein Eingabegerät",
    },
    hotkey: {
      label: "Kürzel",
      ok: (combo: string) => combo,
    },
    acceleration: {
      label: "Beschleunigung",
      gpu: (name: string) => `${name} · GPU aktiv`,
      cpuWithGpu: (name: string) => `Nur CPU · ${name} verfügbar`,
      cpu: "CPU",
    },
    privacy: {
      label: "Datenschutz",
      ok: "100% lokal · keine ausgehende Anfrage",
    },
  },

  tray: {
    open: "Hyperwisper öffnen",
    status: (combo: string) => `Hört zu — ${combo}`,
    quit: "Beenden",
    tooltip: "Hyperwisper — Sprache zu Text",
  },

  settings: {
    general: {
      holdHintPrefix: "Halte",
      holdHintSuffix: "gedrückt, überall in Windows",
      todayLabel: "Heute",
      stat: { dictations: "Diktate", words: "Wörter", audio: "Audio" },
      systemLabel: "System",
      recentTitle: "Letzte Diktate",
      seeAll: "Alle ansehen",
      wordCount: (n: number) => (n === 1 ? "1 Wort" : `${n} Wörter`),
      hero: {
        loading: {
          title: "Startet …",
          subtitle: "Dein System wird geprüft.",
        },
        noModel: {
          title: "Ein Modell fehlt noch.",
          subtitle:
            "Es ist noch kein Whisper-Modell geladen. Hol dir eines unter Modelle.",
        },
        noMic: {
          title: "Kein Mikrofon gefunden.",
          subtitle:
            "Es wurde kein Audio-Eingabegerät erkannt. Schließ ein Mikrofon an oder prüf deine Windows-Einstellungen.",
        },
        setup: {
          title: "Einrichtung offen.",
          subtitle: "Ein paar Punkte fehlen noch, bevor du diktieren kannst.",
        },
        ready: {
          title: "Alles bereit.",
          subtitle:
            "Hyperwisper hört im Hintergrund mit. Der Text landet sofort genau dort, wo dein Cursor steht.",
        },
      },
    },

    models: {
      title: "Modelle",
      description:
        "Wähl ein Whisper-Modell. Alles bleibt auf deinem PC — kein Audio verlässt den Rechner.",
      storageLabel: "Speicher",
      state: { active: "Aktiv" },
      action: {
        load: "Aktivieren",
        download: "Laden",
        downloading: "Lädt",
      },
      reco: {
        tinyQ5_1:
          "Schneller Test, grobe Qualität. Nichts für den täglichen Einsatz.",
        baseQ5_1:
          "Leicht genug für schwache Hardware. Reicht für kurze, einfache Sätze.",
        smallQ5_1: "★ Empfohlen. Das beste Verhältnis aus Qualität und Tempo.",
        small:
          "Small ohne Quantisierung. Minimal genauer, 2,5× schwerer.",
        mediumQ5_0:
          "Für lange, fachliche Diktate. Braucht eine starke CPU.",
        largeV3Q5_0:
          "Maximale Genauigkeit. Selbst auf der GPU langsam, für Diktate übertrieben.",
      },
    },

    audio: {
      title: "Audio",
      description: "Wähl dein Mikrofon und wie ein Diktat ausgelöst wird.",
      microphoneTitle: "Mikrofon",
      defaultDevice: {
        label: "Standardgerät des Systems",
        sublabel: "Folgt automatisch deiner Windows-Auswahl",
      },
      noDevices: "Kein Eingabegerät erkannt.",
      fallbackHint:
        "Wird das gewählte Mikrofon abgezogen, wechselt Hyperwisper automatisch zum Systemstandard.",
      modeTitle: "Aufnahmemodus",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription:
          "Einmal drücken zum Starten, erneut drücken zum Stoppen.",
        pttLabel: "Push-to-talk",
        pttDescription: "Halte die Taste gedrückt, während du sprichst.",
      },
      overlayTitle: "Overlay",
      overlay: {
        fatLabel: "Fat",
        fatDescription:
          "Volle Pille mit Wellenform und Timer. Macht sich bemerkbar.",
        thinLabel: "Thin",
        thinDescription:
          "Schmaler Streifen, nur das Nötigste. Dezent auf dem Bildschirm.",
      },
      overlayHint: "Die Änderung greift ab deiner nächsten Aufnahme.",
      pasteTitle: "Einfügen",
      autoPaste: {
        label: "Automatisch einfügen",
        description:
          "Der Text wird dort eingefügt, wo dein Cursor steht. Schalte es aus, um nur in die Zwischenablage zu kopieren.",
      },
      preserveClipboard: {
        label: "Zwischenablage erhalten",
        description:
          "Stellt ~250 ms nach dem Einfügen wieder her, was du vor dem Diktat kopiert hattest.",
      },
      startupTitle: "Systemstart",
      autoLaunch: {
        label: "Mit Windows starten",
        description:
          "Hyperwisper startet still im Infobereich, sobald du dich anmeldest — das Kürzel ist sofort einsatzbereit.",
      },
    },

    /** Auswahl der Oberflächen- und der Diktatsprache. */
    language: {
      title: "Sprache",
      description:
        "Die Sprache der Oberfläche und die Sprache, in der du diktierst, sind unabhängig voneinander — nutz die App auf Deutsch und diktier in jeder Sprache, die Whisper beherrscht.",
      uiLabel: "Sprache der Oberfläche",
      uiHint: "Beim ersten Start aus Windows übernommen.",
      transcriptionLabel: "Diktatsprache",
      transcriptionHint:
        "Stell hier die Sprache ein, die du tatsächlich sprichst. Die automatische Erkennung funktioniert gut, aber eine feste Sprache ist bei kurzen Diktaten genauer.",
      autoDetect: "Automatisch erkennen",
      autoDetectSublabel: "Whisper erkennt die Sprache am Gesprochenen",
      wellSupportedGroup: "Am besten unterstützt",
      otherGroup: "Weitere Sprachen",
      searchPlaceholder: "Sprache suchen …",
      noResults: "Keine Sprache passt dazu.",
    },

    shortcuts: {
      title: "Tastenkürzel",
      description:
        "Die Taste, die du hältst oder drückst, um ein Diktat zu starten.",
      mainLabel: "Hauptkürzel",
      imeTip: {
        prefix: "Tipp — vermeide",
        middle:
          "bei aktiviertem Windows-IME (Chinesisch, Japanisch, Koreanisch). Nimm lieber",
        or: "oder",
        suffix: "stattdessen.",
      },
      modeLabel: "Modus",
      modeToggle: {
        name: "Toggle",
        description:
          "— einmal drücken zum Starten, erneut zum Stoppen. Ideal für lange Diktate.",
      },
      modePtt: {
        name: "Push-to-talk",
        description:
          "— Taste halten, während du sprichst, loslassen zum Stoppen. Ideal für kurze Sätze.",
      },
      changeModeHintPrefix: "Den Modus änderst du im Tab",
      changeModeHintSuffix: ".",
      editor: {
        capturing: "Drück deine Kombination …",
        escHintSuffix: "zum Abbrechen",
        modeHintPrefix: "Im Modus",
        modeHintToggle:
          "drückst du einmal zum Starten und einmal zum Stoppen.",
        modeHintPtt: "hältst du die Taste, während du sprichst.",
      },
    },

    history: {
      title: "Verlauf",
      description:
        "Jedes Diktat wird lokal gespeichert. Klick einen Eintrag an, um ihn zurück zu kopieren.",
      clearConfirm:
        "Den gesamten Verlauf löschen? Das lässt sich nicht rückgängig machen.",
      dictationCount: (n: number) => (n === 1 ? "Diktat" : "Diktate"),
      wordCountLabel: (n: number) => (n === 1 ? "Wort" : "Wörter"),
      clearAll: "Alle löschen",
      editHint: "Ctrl + ↵ zum Speichern · Esc zum Abbrechen",
      entryWords: (n: number) => (n === 1 ? "1 Wort" : `${n} Wörter`),
      empty: {
        title: "Noch keine Diktate",
        descriptionPrefix: "Drück",
        descriptionSuffix:
          "irgendwo in Windows und sprich. Deine Diktate erscheinen hier.",
      },
    },

    account: {
      title: "Konto",
      description: "Deine Aktivität und deine Einrichtung.",
      heroTitle: "Alles ist dabei.",
      heroBody:
        "Hyperwisper ist kostenlos und quelloffen. Keine Funktion ist gesperrt, kein Abo.",
      included: [
        "Unbegrenzt diktieren, ohne Abo",
        "Alle Whisper-Modelle verfügbar",
        "100 % lokale Transkription (offline)",
        "Automatisch einfügen, wo dein Cursor steht",
        "Vollständiger Verlauf, Suche, Export",
        "GPU-Beschleunigung (Vulkan) integriert",
      ],
      totalsLabel: "Aktivität insgesamt",
      stat: {
        dictations: "Diktate",
        words: "Transkribierte Wörter",
        audio: "Aufgenommenes Audio",
      },
      setupLabel: "Aktuelle Einrichtung",
      rowActiveModel: "Aktives Modell",
      rowVersion: "Version",
    },

    about: {
      tagline:
        "Sofortiges Sprachdiktat. Deine Stimme wird zu Text, überall in Windows. Nichts verlässt deinen Rechner.",
      whyLabel: "Warum",
      why: {
        p1Prefix: "Weil",
        p1Emphasis: "Sprechen",
        p1Suffix:
          "3× schneller ist als Tippen. Deine Gedanken kommen so schnell heraus, wie du sie denkst — ohne den Umweg vom Satz zu den Fingern.",
        p2: "Weil die Alternativen ein Monatsabo verlangen, um quelloffene Technik zu nutzen. Hyperwisper liefert dasselbe Ergebnis — ohne Abo, ohne Cloud, ohne Kompromiss.",
      },
      howLabel: "So funktioniert es",
      step1: {
        titlePrefix: "Du drückst",
        description:
          "Überall in Windows. Auf dem Desktop, in Discord, in Word, im Terminal. Die Pille erscheint auf dem Bildschirm.",
      },
      step2: {
        title: "Du sprichst",
        descriptionPrefix:
          "Hyperwisper hört zu und zeigt dein Audio in Echtzeit. Drück",
        descriptionSuffix: "erneut, wenn du fertig bist.",
      },
      step3: {
        title: "Dein Text wird eingefügt",
        description:
          "Die Transkription läuft in wenigen Sekunden auf deinem PC und landet dann genau dort, wo dein Cursor steht. Als hättest du es getippt.",
      },
      privacyLabel: "Datenschutz",
      privacyBody:
        "Es wird kein Audio ins Internet gesendet. Kein transkribierter Text wird geteilt. Es werden keine Nutzungsdaten erhoben. Alles bleibt für immer auf deinem Rechner.",
      dangerLabel: "Gefahrenzone",
      uninstall: {
        title: "Hyperwisper deinstallieren",
        description:
          "Entfernt die App, das Modell, deine Einstellungen und deinen Verlauf. Du siehst vorher noch eine Bestätigung.",
        button: "Deinstallieren …",
        launching: "Startet …",
      },
      credit: "Gemacht von mathew · 2026",
    },
  },

  onboarding: {
    stepEyebrow: "Schritt",
    welcome: {
      title: "Willkommen bei Hyperwisper.",
      body:
        "Sofortiges Sprachdiktat für Windows. Du sprichst, der Text wird dort eingefügt, wo dein Cursor steht. Alles bleibt auf deinem PC.",
      bullet1: "100 % lokal — kein Audio verlässt deinen Rechner",
      bullet2: "Für immer kostenlos, quelloffen",
      bullet3: "Drei Minuten Einrichtung, los geht's",
      cta: "Loslegen",
    },
    mic: {
      title: "Dein Mikrofon",
      description:
        "Wähl das Mikrofon, auf das Hyperwisper hören soll, und mach einen kurzen Test.",
      deviceLabel: "Mikrofon",
      defaultDevice: {
        label: "Standardgerät des Systems",
        sublabel: "Folgt deiner Windows-Auswahl",
      },
      noDevices: "Kein weiteres Mikrofon erkannt.",
      testLabel: (seconds: number) => `Test (${seconds} Sekunden)`,
      listening: "Hört zu …",
      testButton: "Test",
      retestButton: "Erneut testen",
      soundDetected: "Ton erkannt",
      testHint: (seconds: number) =>
        `Sprich ${seconds} Sekunden lang normal. Der Balken sollte sich bewegen. Bleibt er flach, wähl oben ein anderes Mikrofon.`,
      nextHint: "Mach erst einen Test",
    },
    model: {
      title: "Das Transkriptionsmodell",
      description:
        "Whisper Small bietet das beste Verhältnis aus Qualität und Tempo. Andere kannst du später unter Modelle ausprobieren.",
      sizeAndEta: (sizeMb: number) =>
        `${sizeMb} MB · etwa eine Minute Ladezeit`,
      unavailable: "Nicht verfügbar",
      ready: "Bereit zum Diktieren",
      storageHintPrefix: "Die Datei liegt in",
      storageHintSuffix:
        ". Du kannst sie jederzeit im Tab Modelle löschen.",
      skip: "Ich lade es später",
      nextHint: "Modell nicht geladen",
      badge: {
        active: "Aktiv",
        downloaded: "Geladen",
        toDownload: "Zum Laden",
      },
      error: {
        notFound: (count: number) =>
          `Modell nicht in der Liste gefunden (${count} ${
            count === 1 ? "Eintrag" : "Einträge"
          }). Du kannst diesen Schritt überspringen und es im Tab Modelle laden.`,
        listFailed: (err: string) =>
          `Modellliste konnte nicht geladen werden: ${err}`,
      },
    },
    hotkey: {
      title: "Wie soll ein Diktat starten?",
      description:
        "Wähl dein globales Kürzel und den Aufnahmemodus. Alles davon kannst du später in den Einstellungen ändern.",
      label: "Kürzel",
      modeLabel: "Modus",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription:
          "Einmal drücken zum Starten, erneut drücken zum Stoppen.",
        pttLabel: "Push-to-talk",
        pttDescription: "Halte die Taste, während du sprichst.",
      },
    },
    launch: {
      title: "Mit Windows starten?",
      description:
        "Hyperwisper lebt im Infobereich. Startet es mit Windows, ist dein Kürzel ab der Anmeldung bereit — ganz ohne Zutun.",
      autoLabel: "Beim Start",
      autoDescription:
        "Hyperwisper startet automatisch mit Windows. Empfohlen.",
      manualLabel: "Manuell",
      manualDescription: "Du startest Hyperwisper selbst, wenn du es brauchst.",
      hint:
        "Hyperwisper startet still im Hintergrund: kein Fenster, nur das Symbol im Infobereich. Du kannst es jederzeit im Tab Audio ändern.",
    },
    done: {
      title: "Alles eingerichtet.",
      body:
        "Hyperwisper hört im Hintergrund mit. Halte dein Kürzel in jeder App gedrückt, um zu diktieren.",
      tryNowLabel: "Gleich ausprobieren",
      anywhereSuffix: "überall in Windows.",
      trayHint:
        "Hyperwisper sitzt im Infobereich. Klick auf das Symbol, um die Einstellungen jederzeit wieder zu öffnen.",
      cta: "Fertig",
    },
  },

  installer: {
    titlebarSubtitle: "Installation",
    dirPickerTitle: "Installationsordner wählen",
    pitch: {
      titleLine1: "Schneller",
      titleLine2: "als die Tastatur.",
      body:
        "Hyperwisper macht aus deiner Stimme sofort Text, überall in Windows. Du hältst ein Kürzel, du sprichst, der Text landet an deinem Cursor.",
      statSpeed: "schneller als Tippen",
      statLocal: "lokal, keine Cloud",
      statFree: "für immer kostenlos",
      footnote: "Lokale Installation · Keine Adminrechte",
      cta: "Loslegen",
    },
    configure: {
      eyebrowInstall: "Installation",
      eyebrowReinstall: "Neuinstallation",
      title: "Wohin soll Hyperwisper?",
      body:
        "Behalt den Standardordner, wenn nichts dagegen spricht. Hyperwisper installiert nur für dein Benutzerkonto — ohne Adminrechte.",
      dirLabel: "Installationsordner",
      dirHint: (sizeMb: number) =>
        `Dorthin werden die Programmdatei und das Whisper-Modell (~${sizeMb} MB) kopiert.`,
      resetDir: "Standard zurücksetzen",
      optionsLabel: "Optionen",
      desktopShortcut: {
        label: "Verknüpfung auf dem Desktop anlegen",
        description: "Eine Verknüpfung im Startmenü entsteht ohnehin.",
      },
      ctaInstall: "Installieren",
      ctaReinstall: "Neu installieren",
    },
    installing: {
      eyebrow: "Installation läuft",
      title: "Alles wird eingerichtet.",
      body:
        "Lass dieses Fenster offen. Der Download des Modells dauert etwa eine Minute.",
    },
    stage: {
      copyLabel: "Dateien werden kopiert",
      copySublabel:
        "Legt die Programmdatei ab und registriert den Deinstallations-Eintrag",
      modelLabel: "Whisper-Modell wird geladen",
      modelSublabel: (sizeMb: number) =>
        `Modell Small Q5_1 — etwa ${sizeMb} MB`,
      modelProgress: (doneMb: string, totalMb: string, pct: string) =>
        `${doneMb} / ${totalMb} MB · ${pct} %`,
      finalizeLabel: "Verknüpfungen werden angelegt",
      finalizeSublabel: "Startmenü · Eintrag unter Installierte Apps",
    },
    done: {
      title: "Hyperwisper ist installiert.",
      body:
        "Du kannst diese Setup-Datei löschen. Hyperwisper findest du ab jetzt im Startmenü.",
      installedInLabel: "Installiert in",
      cta: "Hyperwisper starten",
    },
    error: {
      title: "Installation gestoppt.",
      body:
        "Das hat das System gemeldet. Versuch es erneut — hält es an, blockiert meist ein Virenscanner das Kopieren oder das Netz ist beim Laden abgebrochen.",
      unknown: "Unbekannter Fehler",
    },
  },

  uninstaller: {
    titlebarSubtitle: "Deinstallation",
    closeDisabledLabel: "Schließen (während der Deinstallation gesperrt)",
    confirm: {
      title: "Hyperwisper deinstallieren?",
      body:
        "Es wird alles sauber entfernt. Das lässt sich nicht rückgängig machen — deine bisherigen Diktate sind dann nicht mehr wiederherstellbar.",
      listLabel: "Was entfernt wird",
      itemBinary: "Die Programmdatei und der Installationsordner",
      itemModel: (sizeMb: number) =>
        `Das geladene Whisper-Modell (~${sizeMb} MB)`,
      itemData: "Deine Einstellungen, dein Verlauf, deine Protokolle",
      itemShortcuts:
        "Die Verknüpfung im Startmenü (und auf dem Desktop, falls vorhanden)",
      itemAutolaunch: "Der Start mit Windows",
      itemRegistry: "Der Eintrag „Hyperwisper“ unter Installierte Apps",
      cta: "Deinstallieren",
    },
    removing: {
      eyebrow: "Deinstallation läuft",
      title: "Es wird alles aufgeräumt.",
      body: "Schließ das Fenster nicht. Es geht schnell.",
    },
    stage: {
      cleanupLabel: "Dateien und Daten werden entfernt",
      cleanupSublabel:
        "Einstellungen, Verlauf, Modell, Protokolle, Verknüpfungen",
      finalizeLabel: "Windows-Registry wird bereinigt",
      finalizeSublabel: "Deinstallations-Eintrag · Start mit Windows",
    },
    done: {
      title: "Danke fürs Ausprobieren.",
      body:
        "Hyperwisper ist deinstalliert. Der Ordner verschwindet, sobald dieses Fenster schließt. Falls du zurückkommst: Wir sind da.",
    },
    error: {
      title: "Deinstallation unvollständig.",
      bodyPrefix:
        "Das hat das System gemeldet. Du kannst den Installationsordner von Hand löschen und den Registry-Schlüssel selbst entfernen",
      bodySuffix: ".",
      unknown: "Unbekannter Fehler",
    },
  },
};
