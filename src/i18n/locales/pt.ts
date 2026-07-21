import type { Dictionary } from "..";

/**
 * Português do Brasil (pt-BR).
 *
 * Estrutura idêntica a en.ts — veja as regras para tradutores no cabeçalho
 * daquele arquivo. Tratamento informal (“você”), tom próximo e direto.
 */
export const pt: Dictionary = {
  common: {
    loading: "Carregando…",
    saving: "Salvando…",
    save: "Salvar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Excluir",
    copy: "Copiar",
    next: "Avançar",
    back: "Voltar",
    close: "Fechar",
    retry: "Tentar de novo",
    continue: "Continuar",
    unknownError: "Erro desconhecido",
    none: "Nenhum",
  },

  window: {
    minimize: "Minimizar",
    maximize: "Maximizar",
    close: "Fechar",
  },

  nav: {
    general: "Geral",
    models: "Modelos",
    audio: "Áudio",
    shortcuts: "Atalhos",
    history: "Histórico",
    about: "Sobre",
  },

  sidebar: {
    navAriaLabel: "Seções das configurações",
    accountAriaLabel: "Abrir conta",
    accountLabel: "Conta",
  },

  topbar: {
    ariaLabel: "Barra de título",
    theme: {
      light: "Claro",
      dark: "Escuro",
      system: "Sistema",
      groupAriaLabel: "Tema",
    },
  },

  time: {
    justNow: "agora mesmo",
    minutesAgo: (n: number) => `há ${n} min`,
    hoursAgo: (n: number) => `há ${n} h`,
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
    audioSeconds: (sec: string) => `${sec}s de áudio`,
  },

  toast: {
    pasteFailed: {
      title: "Não deu para colar automaticamente",
      description: "O texto está na área de transferência — cole com Ctrl+V.",
    },
    hotkeyConflict: {
      title: "Atalho já em uso",
      withCombo: (combo: string) =>
        `“${combo}” está reservado por outro aplicativo. Troque em Atalhos.`,
      generic:
        "Outro aplicativo já reservou esse atalho. Troque em Atalhos.",
    },
    deviceDisconnect: {
      title: "Microfone desconectado",
      description: "A gravação em andamento foi cancelada.",
    },
    modelLoadError: { title: "Não deu para ler o modelo" },
    recordingError: { title: "A transcrição falhou" },
    noVoice: {
      title: "Nenhuma fala detectada",
      description: "A gravação só capturou silêncio — nada foi colado.",
    },
  },

  overlay: {
    transcribing: "Transcrevendo",
    done: "Colado",
    cancelTitle: "Cancelar (Esc)",
    cancelAriaLabel: "Cancelar ditado",
  },

  systemStatus: {
    whisper: {
      label: "Modelo Whisper",
      loaded: (model: string) => model,
      missing: "Nenhum modelo carregado",
    },
    microphone: {
      label: "Microfone",
      ok: (device: string) => device,
      missing: "Nenhum dispositivo de entrada",
    },
    hotkey: {
      label: "Atalho",
      ok: (combo: string) => combo,
    },
    acceleration: {
      label: "Aceleração",
      gpu: (name: string) => `${name} · GPU ativa`,
      cpuWithGpu: (name: string) => `Só CPU · ${name} disponível`,
      cpu: "CPU",
    },
    privacy: {
      label: "Privacidade",
      ok: "100% local · nenhuma requisição externa",
    },
  },

  tray: {
    open: "Abrir o Hyperwisper",
    status: (combo: string) => `Escutando — ${combo}`,
    quit: "Sair",
    tooltip: "Hyperwisper — voz em texto",
  },

  settings: {
    general: {
      holdHintPrefix: "Segure",
      holdHintSuffix: "em qualquer lugar do Windows",
      todayLabel: "Hoje",
      stat: { dictations: "Ditados", words: "Palavras", audio: "Áudio" },
      systemLabel: "Sistema",
      recentTitle: "Ditados recentes",
      seeAll: "Ver tudo",
      wordCount: (n: number) => (n === 1 ? "1 palavra" : `${n} palavras`),
      hero: {
        loading: {
          title: "Iniciando…",
          subtitle: "Verificando seu sistema.",
        },
        noModel: {
          title: "Falta baixar um modelo.",
          subtitle:
            "Nenhum modelo Whisper foi carregado ainda. Vá em Modelos e pegue um.",
        },
        noMic: {
          title: "Nenhum microfone encontrado.",
          subtitle:
            "Nenhum dispositivo de entrada de áudio foi detectado. Conecte um microfone ou verifique as configurações do Windows.",
        },
        setup: {
          title: "Falta terminar a configuração.",
          subtitle: "Algumas verificações antes de você poder ditar.",
        },
        ready: {
          title: "Tudo pronto.",
          subtitle:
            "O Hyperwisper escuta em segundo plano. O texto é colado bem onde está o seu cursor, na hora.",
        },
      },
    },

    models: {
      title: "Modelos",
      description:
        "Escolha um modelo Whisper. Tudo fica no seu PC — nenhum áudio sai da máquina.",
      storageLabel: "Armazenamento",
      state: { active: "Ativo" },
      action: {
        load: "Carregar",
        download: "Baixar",
        downloading: "Baixando",
      },
      reco: {
        tinyQ5_1:
          "Teste rápido, qualidade tosca. Não serve para o dia a dia.",
        baseQ5_1:
          "Leve o bastante para hardware modesto. Bom para frases curtas e simples.",
        smallQ5_1: "★ Recomendado. O melhor equilíbrio entre qualidade e velocidade.",
        small:
          "Small sem quantização. Um pouco mais preciso, 2,5× mais pesado.",
        mediumQ5_0:
          "Para ditados técnicos longos. Pede uma CPU forte.",
        largeV3Q5_0:
          "Precisão máxima. Lento até com GPU, exagero para ditado.",
      },
    },

    audio: {
      title: "Áudio",
      description: "Escolha seu microfone e como o ditado é acionado.",
      microphoneTitle: "Microfone",
      defaultDevice: {
        label: "Dispositivo padrão do sistema",
        sublabel: "Acompanha automaticamente a escolha do Windows",
      },
      noDevices: "Nenhum dispositivo de entrada detectado.",
      fallbackHint:
        "Se o microfone escolhido for desconectado, o Hyperwisper volta automaticamente para o padrão do sistema.",
      modeTitle: "Modo de gravação",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Aperte uma vez para começar, de novo para parar.",
        pttLabel: "Push-to-talk",
        pttDescription: "Segure a tecla enquanto você fala.",
      },
      overlayTitle: "Overlay",
      overlay: {
        fatLabel: "Fat",
        fatDescription:
          "Pílula completa, com onda sonora e cronômetro. Não passa despercebida.",
        thinLabel: "Thin",
        thinDescription:
          "Faixa mínima, só o essencial. Discreta na tela.",
      },
      overlayHint: "A mudança vale para a sua próxima gravação.",
      pasteTitle: "Colagem",
      autoPaste: {
        label: "Colar automaticamente",
        description:
          "O texto é inserido onde estiver o seu cursor. Desative para apenas copiar para a área de transferência.",
      },
      preserveClipboard: {
        label: "Preservar a área de transferência",
        description:
          "Restaura o que você tinha copiado antes de ditar, cerca de 250 ms depois da colagem.",
      },
      startupTitle: "Inicialização",
      autoLaunch: {
        label: "Abrir junto com o Windows",
        description:
          "O Hyperwisper inicia discretamente na bandeja quando você entra, com o atalho pronto.",
      },
    },

    language: {
      title: "Idioma",
      description:
        "O idioma da interface e o idioma em que você dita são independentes — use o app em português e dite em qualquer idioma que o Whisper suporte.",
      uiLabel: "Idioma da interface",
      uiHint: "Detectado pelo Windows na primeira execução.",
      transcriptionLabel: "Idioma do ditado",
      transcriptionHint:
        "Defina o idioma que você realmente fala. A detecção automática funciona bem, mas indicar o idioma é mais preciso em ditados curtos.",
      autoDetect: "Detectar automaticamente",
      autoDetectSublabel: "O Whisper identifica o idioma pelo que ouve",
      wellSupportedGroup: "Melhor suportados",
      otherGroup: "Outros idiomas",
      searchPlaceholder: "Buscar um idioma…",
      noResults: "Nenhum idioma corresponde.",
    },

    shortcuts: {
      title: "Atalhos",
      description:
        "A tecla que você segura ou aperta para começar um ditado.",
      mainLabel: "Atalho principal",
      imeTip: {
        prefix: "Dica — evite",
        middle:
          "se você tiver um IME do Windows ativado (chinês, japonês, coreano). Prefira",
        or: "ou",
        suffix: "no lugar.",
      },
      modeLabel: "Modo",
      modeToggle: {
        name: "Toggle",
        description:
          "— aperte uma vez para começar, de novo para parar. Melhor para ditados longos.",
      },
      modePtt: {
        name: "Push-to-talk",
        description:
          "— segure a tecla enquanto fala e solte para parar. Melhor para frases curtas.",
      },
      changeModeHintPrefix: "Para mudar de modo, vá até a aba",
      changeModeHintSuffix: ".",
      editor: {
        capturing: "Aperte sua combinação…",
        escHintSuffix: "para cancelar",
        modeHintPrefix: "No modo",
        modeHintToggle: ", aperte uma vez para começar e uma vez para parar.",
        modeHintPtt: ", segure a tecla enquanto você fala.",
      },
    },

    history: {
      title: "Histórico",
      description:
        "Todo ditado fica guardado localmente. Clique em um item para copiá-lo de volta.",
      clearConfirm: "Limpar todo o histórico? Isso não pode ser desfeito.",
      dictationCount: (n: number) => (n === 1 ? "ditado" : "ditados"),
      wordCountLabel: (n: number) => (n === 1 ? "palavra" : "palavras"),
      clearAll: "Limpar tudo",
      editHint: "Ctrl + ↵ para salvar · Esc para cancelar",
      entryWords: (n: number) => (n === 1 ? "1 palavra" : `${n} palavras`),
      empty: {
        title: "Nenhum ditado ainda",
        descriptionPrefix: "Aperte",
        descriptionSuffix:
          "em qualquer lugar do Windows e fale. Seus ditados vão aparecer aqui.",
      },
    },

    account: {
      title: "Conta",
      description: "Sua atividade e sua configuração.",
      heroTitle: "Está tudo incluso.",
      heroBody:
        "O Hyperwisper é gratuito e de código aberto. Nenhum recurso é bloqueado, nenhuma assinatura.",
      included: [
        "Ditado ilimitado, sem assinatura",
        "Todos os modelos Whisper disponíveis",
        "Transcrição 100% local (offline)",
        "Colagem automática onde está o cursor",
        "Histórico completo, busca, exportação",
        "Aceleração por GPU (Vulkan) inclusa",
      ],
      totalsLabel: "Atividade desde o início",
      stat: {
        dictations: "Ditados",
        words: "Palavras transcritas",
        audio: "Áudio capturado",
      },
      setupLabel: "Configuração atual",
      rowActiveModel: "Modelo ativo",
      rowVersion: "Versão",
    },

    about: {
      tagline:
        "Ditado por voz instantâneo. Sua voz vira texto, em qualquer lugar do Windows. Nada sai do seu computador.",
      whyLabel: "Por quê",
      why: {
        p1Prefix: "Porque",
        p1Emphasis: "falar",
        p1Suffix:
          "é 3× mais rápido que digitar. Suas ideias saem na velocidade em que você pensa, sem o desvio mental entre a frase e os dedos.",
        p2: "Porque as alternativas cobram assinatura mensal para usar tecnologia de código aberto. O Hyperwisper entrega o mesmo resultado, sem assinatura, sem nuvem, sem concessões.",
      },
      howLabel: "Como funciona",
      step1: {
        titlePrefix: "Você aperta",
        description:
          "Em qualquer lugar do Windows. Na área de trabalho, no Discord, no Word, no terminal. A pílula aparece na tela.",
      },
      step2: {
        title: "Você fala",
        descriptionPrefix:
          "O Hyperwisper escuta e mostra seu áudio em tempo real. Aperte",
        descriptionSuffix: "de novo quando terminar.",
      },
      step3: {
        title: "Seu texto é colado",
        description:
          "A transcrição acontece no seu PC em poucos segundos e cai exatamente onde está o seu cursor. Como se você tivesse digitado.",
      },
      privacyLabel: "Privacidade",
      privacyBody:
        "Nenhum áudio é enviado pela internet. Nenhum texto transcrito é compartilhado. Nenhuma estatística de uso é coletada. Tudo fica na sua máquina, para sempre.",
      dangerLabel: "Zona de perigo",
      uninstall: {
        title: "Desinstalar o Hyperwisper",
        description:
          "Remove o app, o modelo, suas configurações e seu histórico. Você verá uma tela de confirmação antes.",
        button: "Desinstalar…",
        launching: "Abrindo…",
      },
      credit: "Feito por mathew · 2026",
    },
  },

  onboarding: {
    stepEyebrow: "Etapa",
    welcome: {
      title: "Boas-vindas ao Hyperwisper.",
      body:
        "Ditado por voz instantâneo para Windows. Você fala, o texto é colado onde está o seu cursor. Tudo fica no seu PC.",
      bullet1: "100% local — nenhum áudio sai da sua máquina",
      bullet2: "Gratuito para sempre, código aberto",
      bullet3: "Três minutos para configurar, vamos lá",
      cta: "Começar",
    },
    mic: {
      title: "Seu microfone",
      description:
        "Escolha o microfone que o Hyperwisper deve escutar e faça um teste rápido.",
      deviceLabel: "Microfone",
      defaultDevice: {
        label: "Dispositivo padrão do sistema",
        sublabel: "Acompanha a escolha do Windows",
      },
      noDevices: "Nenhum outro microfone detectado.",
      testLabel: (seconds: number) => `Teste (${seconds} segundos)`,
      listening: "Escutando…",
      testButton: "Testar",
      retestButton: "Testar de novo",
      soundDetected: "Som detectado",
      testHint: (seconds: number) =>
        `Fale normalmente por ${seconds} segundos. A barra deve se mexer. Se ficar parada, escolha outro microfone acima.`,
      nextHint: "Faça um teste antes de continuar",
    },
    model: {
      title: "O modelo de transcrição",
      description:
        "O Whisper Small oferece o melhor equilíbrio entre qualidade e velocidade. Você pode testar outros depois, em Modelos.",
      sizeAndEta: (sizeMb: number) =>
        `${sizeMb} MB · cerca de um minuto para baixar`,
      unavailable: "Indisponível",
      ready: "Pronto para ditar",
      storageHintPrefix: "O arquivo fica guardado em",
      storageHintSuffix:
        ". Você pode excluí-lo quando quiser na aba Modelos.",
      skip: "Baixo depois",
      nextHint: "Modelo não carregado",
      badge: {
        active: "Ativo",
        downloaded: "Baixado",
        toDownload: "A baixar",
      },
      error: {
        notFound: (count: number) =>
          `Modelo não encontrado na lista (${count} ${
            count === 1 ? "item" : "itens"
          }). Você pode pular esta etapa e baixá-lo na aba Modelos.`,
        listFailed: (err: string) =>
          `Não deu para obter a lista de modelos: ${err}`,
      },
    },
    hotkey: {
      title: "Como o ditado deve começar?",
      description:
        "Escolha seu atalho global e o modo de gravação. Você pode mudar tudo depois nas configurações.",
      label: "Atalho",
      modeLabel: "Modo",
      mode: {
        toggleLabel: "Toggle",
        toggleDescription: "Aperte uma vez para começar, de novo para parar.",
        pttLabel: "Push-to-talk",
        pttDescription: "Segure a tecla enquanto você fala.",
      },
    },
    launch: {
      title: "Abrir junto com o Windows?",
      description:
        "O Hyperwisper mora na bandeja. Se ele iniciar com o Windows, seu atalho já está pronto assim que você entra — sem fazer nada.",
      autoLabel: "Na inicialização",
      autoDescription:
        "O Hyperwisper abre automaticamente com o Windows. Recomendado.",
      manualLabel: "Manual",
      manualDescription: "Você abre o Hyperwisper quando precisar.",
      hint:
        "O Hyperwisper inicia discretamente em segundo plano: sem janela, só o ícone na bandeja. Você pode mudar de ideia quando quiser na aba Áudio.",
    },
    done: {
      title: "Tudo certo.",
      body:
        "O Hyperwisper escuta em segundo plano. Segure seu atalho em qualquer app para ditar.",
      tryNowLabel: "Experimente agora",
      anywhereSuffix: "em qualquer lugar do Windows.",
      trayHint:
        "O Hyperwisper fica na bandeja. Clique no ícone para reabrir as configurações quando quiser.",
      cta: "Concluir",
    },
  },

  installer: {
    titlebarSubtitle: "instalação",
    dirPickerTitle: "Escolha a pasta de instalação",
    pitch: {
      titleLine1: "Mais rápido",
      titleLine2: "que o teclado.",
      body:
        "O Hyperwisper transforma sua voz em texto, na hora, em qualquer lugar do Windows. Você segura um atalho, fala, e o texto cai onde está o seu cursor.",
      statSpeed: "mais rápido que digitar",
      statLocal: "local, sem nuvem",
      statFree: "gratuito para sempre",
      footnote: "Instalação local · Sem direitos de administrador",
      cta: "Começar",
    },
    configure: {
      eyebrowInstall: "Instalação",
      eyebrowReinstall: "Reinstalação",
      title: "Onde o Hyperwisper deve ficar?",
      body:
        "Mantenha a pasta padrão, a menos que tenha um motivo para mudar. O Hyperwisper instala só para o seu usuário — sem precisar de administrador.",
      dirLabel: "Pasta de instalação",
      dirHint: (sizeMb: number) =>
        `O binário e o modelo Whisper (~${sizeMb} MB) serão copiados para lá.`,
      resetDir: "Restaurar padrão",
      optionsLabel: "Opções",
      desktopShortcut: {
        label: "Criar atalho na área de trabalho",
        description: "O atalho no menu Iniciar é criado de qualquer forma.",
      },
      ctaInstall: "Instalar",
      ctaReinstall: "Reinstalar",
    },
    installing: {
      eyebrow: "Instalando",
      title: "Preparando tudo.",
      body:
        "Deixe esta janela aberta. Leva um minuto enquanto o modelo é baixado.",
    },
    stage: {
      copyLabel: "Copiando arquivos",
      copySublabel: "Instala o binário e registra a entrada de desinstalação",
      modelLabel: "Baixando o modelo Whisper",
      modelSublabel: (sizeMb: number) =>
        `Modelo Small Q5_1 — cerca de ${sizeMb} MB`,
      modelProgress: (doneMb: string, totalMb: string, pct: string) =>
        `${doneMb} / ${totalMb} MB · ${pct}%`,
      finalizeLabel: "Criando atalhos",
      finalizeSublabel: "Menu Iniciar · entrada em Aplicativos instalados",
    },
    done: {
      title: "O Hyperwisper está instalado.",
      body:
        "Você pode excluir este instalador. Agora o Hyperwisper mora no seu menu Iniciar.",
      installedInLabel: "Instalado em",
      cta: "Abrir o Hyperwisper",
    },
    error: {
      title: "A instalação parou.",
      body:
        "Veja o que o sistema informou. Tente de novo — se persistir, é bem provável que seja um antivírus bloqueando a cópia, ou a rede caindo durante o download.",
      unknown: "Erro desconhecido",
    },
  },

  uninstaller: {
    titlebarSubtitle: "desinstalação",
    closeDisabledLabel: "Fechar (indisponível durante a desinstalação)",
    confirm: {
      title: "Desinstalar o Hyperwisper?",
      body:
        "Tudo será limpo direitinho. Isso não pode ser desfeito — seus ditados anteriores não poderão ser recuperados.",
      listLabel: "O que será removido",
      itemBinary: "O binário e a pasta de instalação",
      itemModel: (sizeMb: number) =>
        `O modelo Whisper baixado (~${sizeMb} MB)`,
      itemData: "Suas configurações, seu histórico, seus logs",
      itemShortcuts: "O atalho do menu Iniciar (e o da área de trabalho, se houver)",
      itemAutolaunch: "A abertura junto com o Windows",
      itemRegistry: "A entrada “Hyperwisper” em Aplicativos instalados",
      cta: "Desinstalar",
    },
    removing: {
      eyebrow: "Desinstalando",
      title: "Limpando tudo.",
      body: "Não feche a janela. É rapidinho.",
    },
    stage: {
      cleanupLabel: "Removendo arquivos e dados",
      cleanupSublabel: "Configurações, histórico, modelo, logs, atalhos",
      finalizeLabel: "Limpando o registro do Windows",
      finalizeSublabel: "Entrada de desinstalação · abertura na inicialização",
    },
    done: {
      title: "Obrigado por experimentar.",
      body:
        "O Hyperwisper foi desinstalado. A pasta é removida assim que esta janela fechar. Se um dia você voltar, estaremos aqui.",
    },
    error: {
      title: "Desinstalação incompleta.",
      bodyPrefix:
        "Veja o que o sistema informou. Você pode excluir a pasta de instalação manualmente e apagar a chave de registro",
      bodySuffix: ".",
      unknown: "Erro desconhecido",
    },
  },
};
