## What this changes

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## How I tested it

<!--
There's no automated test suite yet, so manual steps matter. For example:
- Model: small-q5_1, Vulkan, toggle mode
- Dictated a 20 s sentence into VS Code → pasted correctly
- Checked the overlay in both fat and thin styles
-->

## Checklist

- [ ] `pnpm build` passes (runs `tsc --noEmit`)
- [ ] `cargo fmt` run, if I touched Rust
- [ ] UI changes use the design tokens in `globals.css`, and look right in light **and** dark
- [ ] New UI strings match the existing French *tutoiement* register
- [ ] New Tauri commands are typed in `src/lib/ipc.ts`

## Screenshots

<!-- If you touched the UI. Drag images straight into this box. -->
