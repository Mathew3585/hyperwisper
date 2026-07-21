import type { Dictionary } from "..";

/**
 * Spanish (Spain, es-ES).
 *
 * Informal "tú" throughout — this is a consumer app with a warm, personal
 * tone. Product nouns stay untranslated: Hyperwisper, Whisper, Vulkan,
 * Windows, Toggle, Push-to-talk, Fat, Thin, and model names.
 */
export const es: Dictionary = {
  common: {
    loading: "Cargando…",
    saving: "Guardando…",
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Borrar",
    copy: "Copiar",
    next: "Siguiente",
    back: "Atrás",
    close: "Cerrar",
    retry: "Reintentar",
    continue: "Continuar",
    unknownError: "Error desconocido",
    none: "Ninguno",
  },

  window: {
    minimize: "Minimizar",
    maximize: "Maximizar",
    close: "Cerrar",
  },

  nav: {
    home: "Inicio",
    models: "Modelos",
    settings: "Ajustes",
    history: "Historial",
    about: "Acerca de",
  },

  sidebar: {
    navAriaLabel: "Secciones de ajustes",
    accountAriaLabel: "Abrir la cuenta",
    accountLabel: "Cuenta",
  },

  topbar: {
    ariaLabel: "Barra de título",
    theme: {
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
      groupAriaLabel: "Tema",
    },
  },

  time: {
    justNow: "ahora mismo",
    minutesAgo: (n: number) => `hace ${n} min`,
    hoursAgo: (n: number) => `hace ${n} h`,
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
    audioSeconds: (sec: string) => `${sec}s de audio`,
  },

  toast: {
    pasteFailed: {
      title: "No se pudo pegar automáticamente",
      description: "El texto está en el portapapeles: pégalo con Ctrl+V.",
    },
    hotkeyConflict: {
      title: "El atajo ya está en uso",
      withCombo: (combo: string) =>
        `Otra aplicación tiene asignado “${combo}”. Cámbialo en Atajos.`,
      generic:
        "Otra aplicación ya tiene asignado este atajo. Cámbialo en Atajos.",
    },
    deviceDisconnect: {
      title: "Micrófono desconectado",
      description: "Se ha cancelado la grabación en curso.",
    },
    modelLoadError: { title: "No se pudo leer el modelo" },
    recordingError: { title: "La transcripción ha fallado" },
    noVoice: {
      title: "No se ha detectado voz",
      description: "La grabación solo captó silencio: no se ha pegado nada.",
    },
  },

  overlay: {
    transcribing: "Transcribiendo",
    done: "Pegado",
    cancelTitle: "Cancelar (Esc)",
    cancelAriaLabel: "Cancelar el dictado",
  },

  systemStatus: {
    whisper: {
      label: "Modelo Whisper",
      loaded: (model: string) => model,
      missing: "Ningún modelo cargado",
    },
    microphone: {
      label: "Micrófono",
      ok: (device: string) => device,
      missing: "Sin dispositivo de entrada",
    },
    hotkey: {
      label: "Atajo",
      ok: (combo: string) => combo,
    },
    acceleration: {
      label: "Aceleración",
      gpu: (name: string) => `${name} · GPU activa`,
      cpuWithGpu: (name: string) => `Solo CPU · ${name} disponible`,
      cpu: "CPU",
    },
    privacy: {
      label: "Privacidad",
      ok: "100% local · sin peticiones externas",
    },
  },

  tray: {
    open: "Abrir Hyperwisper",
    status: (combo: string) => `A la escucha — ${combo}`,
    quit: "Salir",
    tooltip: "Hyperwisper — voz a texto",
  },

  settings: {
    panel: {
      title: "Ajustes",
      description: "Todo lo que puedes configurar, en un solo sitio.",
    },

    general: {
      holdHintPrefix: "Mantén pulsado",
      holdHintSuffix: "en cualquier parte de Windows",
      todayLabel: "Hoy",
      stat: { dictations: "Dictados", words: "Palabras", audio: "Audio" },
      totalsLabel: "Desde el inicio",
      totalStat: {
        dictations: "Dictados",
        words: "Palabras transcritas",
        audio: "Audio capturado",
      },
      systemLabel: "Sistema",
      recentTitle: "Dictados recientes",
      seeAll: "Ver todo",
      wordCount: (n: number) => (n === 1 ? "1 palabra" : `${n} palabras`),
      hero: {
        loading: {
          title: "Arrancando…",
          subtitle: "Comprobando tu sistema.",
        },
        noModel: {
          title: "Falta descargar un modelo.",
          subtitle:
            "Aún no hay ningún modelo Whisper cargado. Ve a Modelos para conseguir uno.",
        },
        noMic: {
          title: "No se encuentra ningún micrófono.",
          subtitle:
            "No se detecta ningún dispositivo de entrada de audio. Conecta un micro o revisa los ajustes de Windows.",
        },
        setup: {
          title: "Falta terminar la configuración.",
          subtitle: "Quedan un par de cosas por resolver antes de dictar.",
        },
        ready: {
          title: "Todo listo.",
          subtitle:
            "Hyperwisper escucha en segundo plano. El texto se pega justo donde está tu cursor, al instante.",
        },
      },
    },

    models: {
      title: "Modelos",
      description:
        "Elige un modelo Whisper. Todo se queda en tu PC: ningún audio sale del equipo.",
      storageLabel: "Almacenamiento",
      state: { active: "Activo" },
      action: {
        load: "Cargar",
        download: "Descargar",
        downloading: "Descargando",
      },
      reco: {
        tinyQ5_1:
          "Prueba rápida, calidad tosca. No sirve para dictar a diario.",
        baseQ5_1:
          "Ligero para equipos modestos. Vale para frases cortas y sencillas.",
        smallQ5_1: "★ Recomendado. El mejor equilibrio entre calidad y rapidez.",
        small: "Small sin cuantizar. Un poco más preciso, 2,5× más pesado.",
        mediumQ5_0: "Para dictados técnicos largos. Pide una CPU potente.",
        largeV3Q5_0:
          "Precisión máxima. Lento incluso con GPU, excesivo para dictar.",
      },
    },

    audio: {
      title: "Audio",
      description: "Elige tu micro y cómo se activa el dictado.",
      microphoneTitle: "Micrófono",
      defaultDevice: {
        label: "Dispositivo predeterminado del sistema",
        sublabel: "Sigue automáticamente tu elección de Windows",
      },
      noDevices: "No se detecta ningún dispositivo de entrada.",
      fallbackHint:
        "Si desconectas el micro seleccionado, Hyperwisper vuelve automáticamente al predeterminado del sistema.",
      modeTitle: "Modo de grabación",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Pulsa una vez para empezar y otra para parar.",
        pttLabel: "Push-to-talk",
        pttDescription: "Mantén la tecla pulsada mientras hablas.",
      },
      overlayTitle: "Overlay",
      overlay: {
        fatLabel: "Fat",
        fatDescription:
          "Cápsula completa con onda y cronómetro. No pasa desapercibida.",
        thinLabel: "Thin",
        thinDescription:
          "Franja mínima, solo lo esencial. Discreta en pantalla.",
      },
      overlayHint: "El cambio se aplica en tu próxima grabación.",
      pasteTitle: "Pegado",
      autoPaste: {
        label: "Pegar automáticamente",
        description:
          "El texto se inserta donde esté tu cursor. Desactívalo para copiarlo solo al portapapeles.",
      },
      preserveClipboard: {
        label: "Conservar el portapapeles",
        description:
          "Restaura lo que tenías copiado antes de dictar, unos 250 ms después de pegar.",
      },
      gameModeTitle: "Juegos",
      gameMode: {
        label: "Pausar mientras juegas",
        description:
          "Libera el atajo mientras hay un juego o una aplicación en pantalla completa, para que la tecla llegue al juego en vez de iniciar un dictado. Se restaura automáticamente cuando sales.",
      },
      startupTitle: "Inicio",
      autoLaunch: {
        label: "Iniciar con Windows",
        description:
          "Hyperwisper arranca discretamente en la bandeja al iniciar sesión, con el atajo listo.",
      },
    },

    language: {
      title: "Idioma",
      description:
        "El idioma de la interfaz y el idioma en el que dictas son independientes: puedes usar la app en español y dictar en cualquier idioma compatible con Whisper.",
      uiLabel: "Idioma de la interfaz",
      uiHint: "Se aplica al instante, en todas las ventanas.",
      transcriptionLabel: "Idioma del dictado",
      transcriptionHint:
        "Ponlo en el idioma que hablas de verdad. La detección automática funciona bien, pero indicar el idioma explícitamente es más preciso en dictados cortos.",
      autoDetect: "Detectar automáticamente",
      autoDetectSublabel: "Whisper deduce el idioma de lo que escucha",
      wellSupportedGroup: "Mejor soportados",
      otherGroup: "Otros idiomas",
      searchPlaceholder: "Buscar un idioma…",
      noResults: "Ningún idioma coincide.",
    },

    shortcuts: {
      title: "Atajos",
      description: "La tecla que mantienes o pulsas para empezar a dictar.",
      mainLabel: "Atajo principal",
      imeTip: {
        prefix: "Consejo: evita",
        middle:
          "si tienes activado un IME de Windows (chino, japonés, coreano). Prueba",
        or: "o",
        suffix: "en su lugar.",
      },
      modeLabel: "Modo",
      modeToggle: {
        name: "Toggle",
        description:
          "— pulsa una vez para empezar y otra para parar. Ideal para dictados largos.",
      },
      modePtt: {
        name: "Push-to-talk",
        description:
          "— mantén la tecla mientras hablas y suéltala para parar. Ideal para frases cortas.",
      },
      editor: {
        capturing: "Pulsa tu combinación…",
        escHintSuffix: "para cancelar",
        modeHintPrefix: "En modo",
        modeHintToggle: ", pulsa una vez para empezar y otra para parar.",
        modeHintPtt: ", mantén la tecla mientras hablas.",
      },
    },

    history: {
      title: "Historial",
      description:
        "Cada dictado se guarda en local. Haz clic en una entrada para copiarla de nuevo.",
      clearConfirm: "¿Borrar todo el historial? Esto no se puede deshacer.",
      dictationCount: (n: number): string => (n === 1 ? "dictado" : "dictados"),
      wordCountLabel: (n: number): string => (n === 1 ? "palabra" : "palabras"),
      clearAll: "Borrar todo",
      editHint: "Ctrl + ↵ para guardar · Esc para cancelar",
      entryWords: (n: number) => (n === 1 ? "1 palabra" : `${n} palabras`),
      empty: {
        title: "Todavía no hay dictados",
        descriptionPrefix: "Pulsa",
        descriptionSuffix:
          "en cualquier parte de Windows y habla. Tus dictados aparecerán aquí.",
      },
    },

    about: {
      tagline:
        "Dictado por voz instantáneo. Tu voz se convierte en texto, en cualquier parte de Windows. Nada sale de tu ordenador.",
      whyLabel: "Por qué",
      why: {
        p1Prefix: "Porque",
        p1Emphasis: "hablar",
        p1Suffix:
          "es 3× más rápido que escribir. Tus ideas salen a la velocidad a la que las piensas, sin el rodeo mental entre la frase y tus dedos.",
        p2: "Porque las alternativas piden una suscripción mensual para usar tecnología de código abierto. Hyperwisper da el mismo resultado, sin suscripción, sin nube y sin concesiones.",
      },
      howLabel: "Cómo funciona",
      step1: {
        titlePrefix: "Pulsas",
        description:
          "En cualquier parte de Windows. En el escritorio, en Discord, en Word, en tu terminal. La cápsula aparece en pantalla.",
      },
      step2: {
        title: "Hablas",
        descriptionPrefix:
          "Hyperwisper escucha y visualiza tu audio en tiempo real. Vuelve a pulsar",
        descriptionSuffix: "cuando termines.",
      },
      step3: {
        title: "Tu texto se pega",
        description:
          "La transcripción ocurre en tu PC en un par de segundos y aterriza exactamente donde está tu cursor. Como si lo hubieras escrito tú.",
      },
      privacyLabel: "Privacidad",
      privacyBody:
        "No se envía ningún audio por internet. No se comparte ningún texto transcrito. No se recopila ninguna estadística de uso. Todo se queda en tu equipo, para siempre.",
      dangerLabel: "Zona peligrosa",
      uninstall: {
        title: "Desinstalar Hyperwisper",
        description:
          "Elimina la app, el modelo, tus ajustes y tu historial. Antes verás una pantalla de confirmación.",
        button: "Desinstalar…",
        launching: "Abriendo…",
      },
      credit: "Hecho por mathew · 2026",
    },
  },

  onboarding: {
    stepEyebrow: "Paso",
    language: {
      title: "Elige tu idioma",
      description:
        "Elige el idioma en el que quieres usar Hyperwisper. Puedes cambiarlo cuando quieras desde los ajustes.",
      cta: "Continuar",
    },
    welcome: {
      title: "Te damos la bienvenida a Hyperwisper.",
      body:
        "Dictado por voz instantáneo para Windows. Tú hablas y el texto se pega donde esté tu cursor. Todo se queda en tu PC.",
      bullet1: "100 % local: ningún audio sale de tu equipo",
      bullet2: "Gratis para siempre, código abierto",
      bullet3: "Tres minutos para configurarlo, vamos allá",
      cta: "Empezar",
    },
    mic: {
      title: "Tu micrófono",
      description:
        "Elige el micro que debe escuchar Hyperwisper y haz una prueba rápida.",
      deviceLabel: "Micrófono",
      defaultDevice: {
        label: "Dispositivo predeterminado del sistema",
        sublabel: "Sigue tu elección de Windows",
      },
      noDevices: "No se detecta ningún otro micro.",
      testLabel: (seconds: number) => `Probar (${seconds} segundos)`,
      listening: "Escuchando…",
      testButton: "Probar",
      retestButton: "Probar otra vez",
      soundDetected: "Sonido detectado",
      testHint: (seconds: number) =>
        `Habla con normalidad durante ${seconds} segundos. La barra debería moverse. Si se queda plana, elige otro micro arriba.`,
      nextHint: "Haz una prueba antes de continuar",
    },
    model: {
      title: "El modelo de transcripción",
      description:
        "Whisper Small ofrece el mejor equilibrio entre calidad y rapidez. Puedes probar otros más adelante en Modelos.",
      sizeAndEta: (sizeMb: number) =>
        `${sizeMb} MB · alrededor de un minuto de descarga`,
      unavailable: "No disponible",
      ready: "Listo para dictar",
      storageHintPrefix: "El archivo se guarda en",
      storageHintSuffix:
        ". Puedes borrarlo cuando quieras desde la pestaña Modelos.",
      skip: "Lo descargaré más tarde",
      nextHint: "Modelo no cargado",
      badge: {
        active: "Activo",
        downloaded: "Descargado",
        toDownload: "Por descargar",
      },
      error: {
        notFound: (count: number) =>
          `El modelo no aparece en la lista (${count} ${
            count === 1 ? "entrada" : "entradas"
          }). Puedes saltarte este paso y descargarlo desde la pestaña Modelos.`,
        listFailed: (err: string) =>
          `No se pudo obtener la lista de modelos: ${err}`,
      },
    },
    hotkey: {
      title: "¿Cómo quieres empezar a dictar?",
      description:
        "Elige tu atajo global y el modo de grabación. Podrás cambiarlo todo más tarde en los ajustes.",
      label: "Atajo",
      modeLabel: "Modo",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Pulsa una vez para empezar y otra para parar.",
        pttLabel: "Push-to-talk",
        pttDescription: "Mantén la tecla mientras hablas.",
      },
    },
    launch: {
      title: "¿Iniciar con Windows?",
      description:
        "Hyperwisper vive en la bandeja del sistema. Si arranca con Windows, tu atajo está listo nada más iniciar sesión, sin hacer nada.",
      autoLabel: "Al iniciar",
      autoDescription:
        "Hyperwisper arranca automáticamente con Windows. Recomendado.",
      manualLabel: "Manual",
      manualDescription: "Abres Hyperwisper tú mismo cuando lo necesitas.",
      hint:
        "Hyperwisper arranca discretamente en segundo plano: sin ventana, solo el icono de la bandeja. Puedes cambiar de idea cuando quieras desde la pestaña Audio.",
    },
    done: {
      title: "Ya está todo listo.",
      body:
        "Hyperwisper escucha en segundo plano. Mantén pulsado tu atajo en cualquier app para dictar.",
      tryNowLabel: "Pruébalo ahora",
      anywhereSuffix: "en cualquier parte de Windows.",
      trayHint:
        "Hyperwisper se queda en la bandeja del sistema. Haz clic en el icono para volver a abrir los ajustes cuando quieras.",
      cta: "Finalizar",
    },
  },

  installer: {
    titlebarSubtitle: "instalación",
    dirPickerTitle: "Elige la carpeta de instalación",
    pitch: {
      titleLine1: "Más rápido",
      titleLine2: "que el teclado.",
      body:
        "Hyperwisper convierte tu voz en texto, al instante, en cualquier parte de Windows. Mantienes un atajo, hablas y el texto aterriza donde está tu cursor.",
      statSpeed: "más rápido que escribir",
      statLocal: "local, sin nube",
      statFree: "gratis para siempre",
      footnote: "Instalación local · Sin permisos de administrador",
      cta: "Empezar",
    },
    configure: {
      eyebrowInstall: "Instalación",
      eyebrowReinstall: "Reinstalación",
      title: "¿Dónde instalamos Hyperwisper?",
      body:
        "Deja la carpeta predeterminada salvo que tengas un motivo para cambiarla. Hyperwisper se instala solo para tu usuario: no hace falta ser administrador.",
      dirLabel: "Carpeta de instalación",
      dirHint: (sizeMb: number) =>
        `Allí se copiarán el ejecutable y el modelo Whisper (~${sizeMb} MB).`,
      resetDir: "Restaurar predeterminada",
      optionsLabel: "Opciones",
      desktopShortcut: {
        label: "Añadir un acceso directo en el escritorio",
        description:
          "En cualquier caso se crea un acceso directo en el menú Inicio.",
      },
      ctaInstall: "Instalar",
      ctaReinstall: "Reinstalar",
    },
    installing: {
      eyebrow: "Instalando",
      title: "Preparándolo todo.",
      body:
        "Deja esta ventana abierta. Tarda un minuto mientras se descarga el modelo.",
    },
    stage: {
      copyLabel: "Copiando archivos",
      copySublabel:
        "Coloca el ejecutable y registra la entrada de desinstalación",
      modelLabel: "Descargando el modelo Whisper",
      modelSublabel: (sizeMb: number) =>
        `Modelo Small Q5_1 — unos ${sizeMb} MB`,
      modelProgress: (doneMb: string, totalMb: string, pct: string) =>
        `${doneMb} / ${totalMb} MB · ${pct} %`,
      finalizeLabel: "Creando accesos directos",
      finalizeSublabel: "Menú Inicio · entrada en Aplicaciones instaladas",
    },
    done: {
      title: "Hyperwisper está instalado.",
      body:
        "Ya puedes borrar este archivo de instalación. Hyperwisper vive ahora en tu menú Inicio.",
      installedInLabel: "Instalado en",
      cta: "Abrir Hyperwisper",
    },
    error: {
      title: "La instalación se ha detenido.",
      body:
        "Esto es lo que ha reportado el sistema. Inténtalo de nuevo: si persiste, lo más probable es que un antivirus esté bloqueando la copia o que la red se haya cortado durante la descarga.",
      unknown: "Error desconocido",
    },
  },

  uninstaller: {
    titlebarSubtitle: "desinstalación",
    closeDisabledLabel: "Cerrar (no disponible durante la desinstalación)",
    confirm: {
      title: "¿Desinstalar Hyperwisper?",
      body:
        "Se limpiará todo correctamente. Esto no se puede deshacer: tus dictados anteriores no se podrán recuperar.",
      listLabel: "Qué se va a eliminar",
      itemBinary: "El ejecutable y la carpeta de instalación",
      itemModel: (sizeMb: number) =>
        `El modelo Whisper descargado (~${sizeMb} MB)`,
      itemData: "Tus ajustes, tu historial y tus registros",
      itemShortcuts:
        "El acceso directo del menú Inicio (y el del escritorio, si lo hay)",
      itemAutolaunch: "El inicio automático con Windows",
      itemRegistry: "La entrada “Hyperwisper” en Aplicaciones instaladas",
      cta: "Desinstalar",
    },
    removing: {
      eyebrow: "Desinstalando",
      title: "Limpiándolo todo.",
      body: "No cierres la ventana. Esto es rápido.",
    },
    stage: {
      cleanupLabel: "Eliminando archivos y datos",
      cleanupSublabel:
        "Ajustes, historial, modelo, registros y accesos directos",
      finalizeLabel: "Limpiando el registro de Windows",
      finalizeSublabel: "Entrada de desinstalación · inicio automático",
    },
    done: {
      title: "Gracias por haberlo probado.",
      body:
        "Hyperwisper está desinstalado. La carpeta se elimina en cuanto se cierre esta ventana. Si algún día vuelves, aquí estaremos.",
    },
    error: {
      title: "Desinstalación incompleta.",
      bodyPrefix:
        "Esto es lo que ha reportado el sistema. Puedes borrar la carpeta de instalación a mano y eliminar la clave del registro",
      bodySuffix: ".",
      unknown: "Error desconocido",
    },
  },
};
