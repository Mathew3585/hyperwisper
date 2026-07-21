/**
 * English — the source of truth for every other locale.
 *
 * `Dictionary` in ../index.tsx is `typeof en`, so any locale missing a key,
 * or giving one the wrong shape, fails the build. Add keys here first.
 *
 * RULES FOR TRANSLATORS
 * ---------------------
 * 1. Values are plain strings or functions returning strings. Never JSX —
 *    components assemble any markup from `prefix`/`suffix` pairs. This keeps
 *    locale files pure data, so translating needs no React knowledge.
 * 2. Anything inside {braces} in a comment marks an interpolated value.
 * 3. Count-dependent strings take `(n: number)` and must handle n === 1.
 *    Do not assume English or French plural rules.
 * 4. Product nouns stay untranslated: Hyperwisper, Whisper, Vulkan, Windows,
 *    Toggle, Push-to-talk, Fat, Thin, and model names (Small, Q5_1…).
 */
export const en = {
  common: {
    loading: "Loading…",
    saving: "Saving…",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    copy: "Copy",
    next: "Next",
    back: "Back",
    close: "Close",
    retry: "Try again",
    continue: "Continue",
    unknownError: "Unknown error",
    none: "None",
  },

  window: {
    minimize: "Minimize",
    maximize: "Maximize",
    close: "Close",
  },

  nav: {
    general: "General",
    models: "Models",
    audio: "Audio",
    shortcuts: "Shortcuts",
    history: "History",
    about: "About",
  },

  sidebar: {
    navAriaLabel: "Settings sections",
    accountAriaLabel: "Open account",
    accountLabel: "Account",
  },

  topbar: {
    ariaLabel: "Title bar",
    theme: {
      light: "Light",
      dark: "Dark",
      system: "System",
      groupAriaLabel: "Theme",
    },
  },

  /**
   * Relative time. Both the history list and the dashboard use these, so the
   * two panels can no longer drift apart the way they had.
   */
  time: {
    justNow: "just now",
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} h ago`,
  },

  units: {
    /** Short audio duration, e.g. "42s". */
    seconds: (s: number) => `${s}s`,
    /** e.g. "3m 12s" */
    minutesSeconds: (m: number, s: number) => `${m}m ${s}s`,
    /** e.g. "2h" */
    hours: (h: number) => `${h}h`,
    /** Spelled-out variant used on the Account panel, e.g. "7 min". */
    minutesLong: (m: number) => `${m} min`,
    hoursLong: (h: number) => `${h} h`,
    megabytes: (mb: number | string) => `${mb} MB`,
    kilobytes: (kb: string) => `${kb} KB`,
    bytes: (b: number) => `${b} B`,
    /** Audio length of one dictation, e.g. "4.2s of audio". */
    audioSeconds: (sec: string) => `${sec}s of audio`,
  },

  toast: {
    pasteFailed: {
      title: "Couldn't paste automatically",
      description: "The text is on your clipboard — paste it with Ctrl+V.",
    },
    hotkeyConflict: {
      title: "Shortcut already in use",
      withCombo: (combo: string) =>
        `“${combo}” is captured by another app. Change it under Shortcuts.`,
      generic:
        "Another application already captured this shortcut. Change it under Shortcuts.",
    },
    deviceDisconnect: {
      title: "Microphone disconnected",
      description: "The recording in progress was cancelled.",
    },
    modelLoadError: { title: "Couldn't read the model" },
    recordingError: { title: "Transcription failed" },
    noVoice: {
      title: "No speech detected",
      description: "The recording captured only silence — nothing was pasted.",
    },
  },

  overlay: {
    transcribing: "Transcribing",
    done: "Pasted",
    cancelTitle: "Cancel (Esc)",
    cancelAriaLabel: "Cancel dictation",
  },

  /**
   * Labels for the Rust `get_system_status` payload. The backend now sends
   * stable ids instead of prose, so these live here and follow the UI
   * language like everything else.
   */
  systemStatus: {
    whisper: {
      label: "Whisper",
      loaded: (model: string) => model,
      missing: "No model loaded",
    },
    microphone: {
      label: "Microphone",
      ok: (device: string) => device,
      missing: "No microphone detected",
    },
    hotkey: {
      label: "Shortcut",
      ok: (combo: string) => combo,
    },
    acceleration: {
      label: "Acceleration",
      gpu: (name: string) => `${name} · GPU active`,
      cpuWithGpu: (name: string) => `CPU only · ${name} available`,
      cpu: "CPU",
    },
    privacy: {
      label: "Privacy",
      ok: "100% local · no outbound request",
    },
  },

  /**
   * Windows tray menu. Rust owns no dictionary — the front-end sends these
   * down through `set_tray_labels` on mount and on every language change.
   */
  tray: {
    open: "Open Hyperwisper",
    status: (combo: string) => `Listening — ${combo}`,
    quit: "Quit",
    tooltip: "Hyperwisper — voice to text",
  },

  settings: {
    general: {
      holdHintPrefix: "Hold",
      holdHintSuffix: "anywhere in Windows",
      todayLabel: "Today",
      stat: { dictations: "Dictations", words: "Words", audio: "Audio" },
      systemLabel: "System",
      recentTitle: "Recent dictations",
      seeAll: "See all",
      wordCount: (n: number) => (n === 1 ? "1 word" : `${n} words`),
      hero: {
        loading: {
          title: "Starting up…",
          subtitle: "Checking your system.",
        },
        noModel: {
          title: "A model to download.",
          subtitle:
            "No Whisper model is loaded yet. Head to Models to grab one.",
        },
        noMic: {
          title: "No microphone found.",
          subtitle:
            "No audio input device is detected. Plug a mic in, or check your Windows settings.",
        },
        setup: {
          title: "Setup to finish.",
          subtitle: "A few checks to sort out before you can dictate.",
        },
        ready: {
          title: "Everything's ready.",
          subtitle:
            "Hyperwisper listens in the background. Text is pasted right where your cursor is, immediately.",
        },
      },
    },

    models: {
      title: "Models",
      description:
        "Pick a Whisper model. Everything stays on your PC — no audio leaves the machine.",
      storageLabel: "Storage",
      state: { active: "Active" },
      action: {
        load: "Load",
        download: "Download",
        downloading: "Downloading",
      },
      reco: {
        tinyQ5_1:
          "Quick smoke test, rough quality. Not for everyday dictation.",
        baseQ5_1:
          "Light enough for modest hardware. Fine for short, simple sentences.",
        smallQ5_1: "★ Recommended. The best quality/speed trade-off.",
        small:
          "Unquantized Small. Marginally more accurate, 2.5× heavier.",
        mediumQ5_0:
          "For long technical dictations. Wants a strong CPU.",
        largeV3Q5_0:
          "Maximum accuracy. Slow even on GPU, overkill for dictation.",
      },
    },

    audio: {
      title: "Audio",
      description: "Choose your mic and how dictation is triggered.",
      microphoneTitle: "Microphone",
      defaultDevice: {
        label: "System default device",
        sublabel: "Follows your Windows choice automatically",
      },
      noDevices: "No input device detected.",
      fallbackHint:
        "If the selected mic is unplugged, Hyperwisper falls back to the system default automatically.",
      modeTitle: "Recording mode",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Press once to start, press again to stop.",
        pttLabel: "Push-to-talk",
        pttDescription: "Hold the key down while you speak.",
      },
      overlayTitle: "Overlay",
      overlay: {
        fatLabel: "Fat",
        fatDescription:
          "Full pill with waveform and timer. Makes its presence known.",
        thinLabel: "Thin",
        thinDescription:
          "Minimal sliver, just the essentials. Discreet on screen.",
      },
      overlayHint: "The change applies to your next recording.",
      pasteTitle: "Pasting",
      autoPaste: {
        label: "Paste automatically",
        description:
          "Text is inserted wherever your cursor is. Turn off to only copy to the clipboard.",
      },
      preserveClipboard: {
        label: "Preserve the clipboard",
        description:
          "Restores whatever you had copied before dictating, ~250 ms after the paste.",
      },
      startupTitle: "Startup",
      autoLaunch: {
        label: "Launch when Windows starts",
        description:
          "Hyperwisper starts quietly in the tray when you sign in, shortcut ready to go.",
      },
    },

    /** The UI-language and transcription-language pickers. */
    language: {
      title: "Language",
      description:
        "The interface language and the language you dictate in are separate — run the app in English and dictate in any language Whisper supports.",
      uiLabel: "Interface language",
      uiHint: "Detected from Windows on first launch.",
      transcriptionLabel: "Dictation language",
      transcriptionHint:
        "Set this to the language you actually speak. Auto-detect works well, but naming the language explicitly is more accurate on short dictations.",
      autoDetect: "Detect automatically",
      autoDetectSublabel: "Whisper picks the language from what it hears",
      wellSupportedGroup: "Best supported",
      otherGroup: "Other languages",
      searchPlaceholder: "Search a language…",
      noResults: "No language matches that.",
    },

    shortcuts: {
      title: "Shortcuts",
      description:
        "The key you hold or press to start a dictation.",
      mainLabel: "Main shortcut",
      imeTip: {
        prefix: "Tip — avoid",
        middle:
          "if you have a Windows IME enabled (Chinese, Japanese, Korean). Try",
        or: "or",
        suffix: "instead.",
      },
      modeLabel: "Mode",
      modeToggle: {
        name: "Toggle",
        description:
          "— press once to start, again to stop. Best for long dictations.",
      },
      modePtt: {
        name: "Push-to-talk",
        description:
          "— hold the key while you speak, release to stop. Best for short phrases.",
      },
      changeModeHintPrefix: "To change mode, go to the",
      changeModeHintSuffix: "tab.",
      editor: {
        capturing: "Press your combination…",
        escHintSuffix: "to cancel",
        modeHintPrefix: "In",
        modeHintToggle: "mode, press once to start and once to stop.",
        modeHintPtt: "mode, hold the key while you speak.",
      },
    },

    history: {
      title: "History",
      description:
        "Every dictation is stored locally. Click an entry to copy it back.",
      clearConfirm: "Clear the entire history? This cannot be undone.",
      // Annotated `: string` — without it TS infers the literal union
      // ("dictation" | "dictations") and `Dictionary` would demand the English
      // words verbatim, which no translation can satisfy.
      dictationCount: (n: number): string => (n === 1 ? "dictation" : "dictations"),
      wordCountLabel: (n: number): string => (n === 1 ? "word" : "words"),
      clearAll: "Clear all",
      editHint: "Ctrl + ↵ to save · Esc to cancel",
      entryWords: (n: number) => (n === 1 ? "1 word" : `${n} words`),
      empty: {
        title: "No dictations yet",
        descriptionPrefix: "Press",
        descriptionSuffix:
          "anywhere in Windows and speak. Your dictations will show up here.",
      },
    },

    account: {
      title: "Account",
      description: "Your activity and your setup.",
      heroTitle: "Everything's included.",
      heroBody:
        "Hyperwisper is free and open source. No feature is locked, no subscription.",
      included: [
        "Unlimited dictation, no subscription",
        "Every Whisper model available",
        "100% local transcription (offline)",
        "Auto-paste wherever your cursor is",
        "Full history, search, export",
        "GPU acceleration (Vulkan) built in",
      ],
      totalsLabel: "All-time activity",
      stat: {
        dictations: "Dictations",
        words: "Words transcribed",
        audio: "Audio captured",
      },
      setupLabel: "Current setup",
      rowActiveModel: "Active model",
      rowVersion: "Version",
    },

    about: {
      tagline:
        "Instant voice dictation. Your voice becomes text, anywhere in Windows. Nothing leaves your computer.",
      whyLabel: "Why",
      why: {
        p1Prefix: "Because",
        p1Emphasis: "speaking",
        p1Suffix:
          "is 3× faster than typing. Your ideas come out at the speed you think them, with no mental round trip between the sentence and your fingers.",
        p2: "Because the alternatives ask for a monthly subscription to use open-source technology. Hyperwisper is the same result, with no subscription, no cloud, no compromise.",
      },
      howLabel: "How it works",
      step1: {
        titlePrefix: "You press",
        description:
          "Anywhere in Windows. On your desktop, in Discord, in Word, in your terminal. The pill appears on screen.",
      },
      step2: {
        title: "You speak",
        descriptionPrefix:
          "Hyperwisper listens and visualises your audio in real time. Press",
        descriptionSuffix: "again when you're done.",
      },
      step3: {
        title: "Your text is pasted",
        description:
          "Transcription happens on your PC in a couple of seconds, then lands exactly where your cursor is. As if you'd typed it.",
      },
      privacyLabel: "Privacy",
      privacyBody:
        "No audio is sent over the internet. No transcribed text is shared. No usage statistics are collected. Everything stays on your machine, forever.",
      dangerLabel: "Danger zone",
      uninstall: {
        title: "Uninstall Hyperwisper",
        description:
          "Removes the app, the model, your settings and your history. You'll see a confirmation screen first.",
        button: "Uninstall…",
        launching: "Launching…",
      },
      credit: "Made by mathew · 2026",
    },
  },

  onboarding: {
    stepEyebrow: "Step",
    welcome: {
      title: "Welcome to Hyperwisper.",
      body:
        "Instant voice dictation for Windows. You speak, the text is pasted wherever your cursor is. Everything stays on your PC.",
      bullet1: "100% local — no audio leaves your machine",
      bullet2: "Free forever, open source",
      bullet3: "Three minutes to set up, let's go",
      cta: "Get started",
    },
    mic: {
      title: "Your microphone",
      description:
        "Choose the mic Hyperwisper should listen to, then run a quick test.",
      deviceLabel: "Microphone",
      defaultDevice: {
        label: "System default device",
        sublabel: "Follows your Windows choice",
      },
      noDevices: "No other mic detected.",
      testLabel: (seconds: number) => `Test (${seconds} seconds)`,
      listening: "Listening…",
      testButton: "Test",
      retestButton: "Test again",
      soundDetected: "Sound detected",
      testHint: (seconds: number) =>
        `Speak normally for ${seconds} seconds. The bar should move. If it stays flat, pick a different mic above.`,
      nextHint: "Run a test before continuing",
    },
    model: {
      title: "The transcription model",
      description:
        "Whisper Small offers the best quality/speed trade-off. You can try others later under Models.",
      sizeAndEta: (sizeMb: number) =>
        `${sizeMb} MB · about a minute to download`,
      unavailable: "Unavailable",
      ready: "Ready to dictate",
      storageHintPrefix: "The file is stored in",
      storageHintSuffix:
        ". You can delete it at any time from the Models tab.",
      skip: "I'll download it later",
      nextHint: "Model not loaded",
      badge: {
        active: "Active",
        downloaded: "Downloaded",
        toDownload: "To download",
      },
      error: {
        notFound: (count: number) =>
          `Model not found in the list (${count} ${
            count === 1 ? "entry" : "entries"
          }). You can skip this step and download it from the Models tab.`,
        listFailed: (err: string) => `Couldn't fetch the model list: ${err}`,
      },
    },
    hotkey: {
      title: "How should dictation start?",
      description:
        "Choose your global shortcut and recording mode. You can change all of it later in Settings.",
      label: "Shortcut",
      modeLabel: "Mode",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Press once to start, press again to stop.",
        pttLabel: "Push-to-talk",
        pttDescription: "Hold the key while you speak.",
      },
    },
    launch: {
      title: "Launch at startup?",
      description:
        "Hyperwisper lives in the tray. If it starts with Windows, your shortcut is ready the moment you sign in — nothing to do.",
      autoLabel: "At startup",
      autoDescription: "Hyperwisper starts automatically with Windows. Recommended.",
      manualLabel: "Manual",
      manualDescription: "You start Hyperwisper yourself when you need it.",
      hint:
        "Hyperwisper starts quietly in the background: no window, just the tray icon. You can change your mind at any time from the Audio tab.",
    },
    done: {
      title: "You're all set.",
      body:
        "Hyperwisper listens in the background. Hold your shortcut in any app to dictate.",
      tryNowLabel: "Try it now",
      anywhereSuffix: "anywhere in Windows.",
      trayHint:
        "Hyperwisper sits in the tray. Click the icon to reopen settings at any time.",
      cta: "Finish",
    },
  },

  installer: {
    titlebarSubtitle: "installation",
    dirPickerTitle: "Choose the installation folder",
    pitch: {
      titleLine1: "Faster",
      titleLine2: "than the keyboard.",
      body:
        "Hyperwisper turns your voice into text, instantly, anywhere in Windows. You hold a shortcut, you speak, the text lands where your cursor is.",
      statSpeed: "faster than typing",
      statLocal: "local, no cloud",
      statFree: "free forever",
      footnote: "Local install · No administrator rights",
      cta: "Get started",
    },
    configure: {
      eyebrowInstall: "Installation",
      eyebrowReinstall: "Reinstallation",
      title: "Where should Hyperwisper go?",
      body:
        "Keep the default folder unless you have a reason not to. Hyperwisper installs for your user only — no admin needed.",
      dirLabel: "Installation folder",
      dirHint: (sizeMb: number) =>
        `The binary and the Whisper model (~${sizeMb} MB) will be copied there.`,
      resetDir: "Restore default",
      optionsLabel: "Options",
      desktopShortcut: {
        label: "Add a desktop shortcut",
        description: "A Start menu shortcut is created either way.",
      },
      ctaInstall: "Install",
      ctaReinstall: "Reinstall",
    },
    installing: {
      eyebrow: "Installing",
      title: "Setting things up.",
      body:
        "Keep this window open. It takes a minute while the model downloads.",
    },
    stage: {
      copyLabel: "Copying files",
      copySublabel: "Drops the binary and registers the Uninstall entry",
      modelLabel: "Downloading the Whisper model",
      modelSublabel: (sizeMb: number) => `Small Q5_1 model — about ${sizeMb} MB`,
      modelProgress: (doneMb: string, totalMb: string, pct: string) =>
        `${doneMb} / ${totalMb} MB · ${pct}%`,
      finalizeLabel: "Creating shortcuts",
      finalizeSublabel: "Start menu · entry in Installed apps",
    },
    done: {
      title: "Hyperwisper is installed.",
      body:
        "You can delete this setup file. Hyperwisper now lives in your Start menu.",
      installedInLabel: "Installed in",
      cta: "Launch Hyperwisper",
    },
    error: {
      title: "Installation stopped.",
      body:
        "Here's what the system reported. Try again — if it persists, it's most likely an antivirus blocking the copy, or the network dropping during the download.",
      unknown: "Unknown error",
    },
  },

  uninstaller: {
    titlebarSubtitle: "uninstallation",
    closeDisabledLabel: "Close (unavailable while uninstalling)",
    confirm: {
      title: "Uninstall Hyperwisper?",
      body:
        "Everything will be cleaned up properly. This cannot be undone — your past dictations will not be recoverable.",
      listLabel: "What will be removed",
      itemBinary: "The binary and the installation folder",
      itemModel: (sizeMb: number) => `The downloaded Whisper model (~${sizeMb} MB)`,
      itemData: "Your settings, your history, your logs",
      itemShortcuts: "The Start menu shortcut (and desktop, if any)",
      itemAutolaunch: "Launch at Windows startup",
      itemRegistry: "The “Hyperwisper” entry in Installed apps",
      cta: "Uninstall",
    },
    removing: {
      eyebrow: "Uninstalling",
      title: "Cleaning everything up.",
      body: "Don't close the window. This is quick.",
    },
    stage: {
      cleanupLabel: "Removing files and data",
      cleanupSublabel: "Settings, history, model, logs, shortcuts",
      finalizeLabel: "Cleaning the Windows registry",
      finalizeSublabel: "Uninstall entry · launch at startup",
    },
    done: {
      title: "Thanks for giving it a go.",
      body:
        "Hyperwisper is uninstalled. The folder is removed as soon as this window closes. If you ever come back, we'll be here.",
    },
    error: {
      title: "Uninstall incomplete.",
      bodyPrefix:
        "Here's what the system reported. You can delete the installation folder manually, and clear the registry key",
      bodySuffix: ".",
      unknown: "Unknown error",
    },
  },
};
// NOTE: deliberately no `as const`. With it, every value would take a literal
// type ("Loading…" rather than string) and no translation could ever satisfy
// `Dictionary` — the type would demand the English text verbatim.
