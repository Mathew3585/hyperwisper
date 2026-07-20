# Contributing to Hyperwisper

Thanks for being here. Hyperwisper is a small, opinionated project, but it is genuinely open —
fork it, change it, ship your own version. Contributions of any size are welcome.

## Getting set up

The full toolchain and the two mandatory environment variables are documented in
[README → Build from source](README.md#build-from-source). The short version:

```powershell
pnpm install
.\scripts\dev.ps1     # sets LIBCLANG_PATH, VULKAN_SDK, CARGO_TARGET_DIR, then runs the dev server
```

Do not skip `scripts/dev.ps1` on your first run. A bare `pnpm tauri:dev` in a fresh shell fails
because `LIBCLANG_PATH` and the short `CARGO_TARGET_DIR` aren't set — the latter is what keeps
whisper.cpp's Vulkan shader build under Windows' 260-character path limit.

Budget 10–20 minutes for the first compile. Subsequent builds are incremental and fast.

## Where things live

| I want to change… | Look in |
|---|---|
| The recording pill | `src/windows/overlay/OverlayApp.tsx` |
| A settings screen | `src/windows/settings/panels/` |
| The first-run wizard | `src/windows/settings/onboarding/OnboardingWizard.tsx` |
| Colors, spacing, type | `src/styles/globals.css` (design tokens) |
| The dictation pipeline | `src-tauri/src/recording.rs` |
| Audio capture / resampling | `src-tauri/src/audio/` |
| Whisper params or the model catalog | `src-tauri/src/whisper/` |
| A new command exposed to the UI | `src-tauri/src/commands/mod.rs` + register in `lib.rs` + type in `src/lib/ipc.ts` |

## Conventions

**Rust.** `cargo fmt` before committing. Keep the audio callback allocation-free — it runs on a
realtime thread, and the existing code deliberately reuses scratch buffers. Anything that can
block goes on `spawn_blocking`.

**TypeScript.** `pnpm build` runs `tsc --noEmit` and must pass. No `any` in the IPC layer:
if you add a command, type it in `src/lib/ipc.ts` so the boundary stays honest.

**Design.** The visual language is "Quiet Premium" — ink, paper and sand. Warm neutrals, a single
terracotta accent used sparingly, no purple, no marketing gradients. Use the CSS custom properties
in `globals.css` rather than hardcoding colors, and it'll look right in both themes automatically.

**UI strings** are currently French and inline in the TSX. If you're adding UI, match the existing
informal *tutoiement* register ("tu", not "vous"). If you're the person who introduces an i18n
layer, that's a very welcome PR — please open an issue first so we can agree on the approach.

**Commits.** Conventional Commits are appreciated but not enforced:
`feat: expose language selection in settings`, `fix: restore clipboard after failed paste`.

## Pull requests

1. Open an issue first for anything structural. Small fixes can go straight to a PR.
2. Keep PRs focused — one concern per PR reviews far faster.
3. Say how you tested it. There's no test suite yet, so manual verification steps matter:
   which model, which mode, what you dictated, what happened.
4. If you touched the UI, a screenshot or a short clip goes a long way.

## Good first issues

Listed with difficulty in [README → Help wanted](README.md#help-wanted). The two easiest and most
valuable right now are **translating the UI to English** and **wiring language selection into
settings** — the plumbing already exists on both sides, it just isn't connected.

## Reporting bugs

Include your Windows version, GPU, the model you were using, and the relevant slice of
`%APPDATA%\Hyperwisper\logs\hyperwisper.log.<date>`. Set `RUST_LOG=hyperwisper=debug` for a
more detailed trace.

Please scan the log before pasting it — it records dictation metadata, and transcribed text
lives next to it in `history.jsonl`.

## Code of conduct

Be decent to each other. Assume good faith, critique code rather than people, and remember that
everyone here is doing this for free in their spare time.
