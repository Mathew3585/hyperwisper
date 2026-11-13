import { useMemo } from "react";

import { useI18n } from "@/i18n";
import { LanguageRow } from "./LanguageSection";

/**
 * Languages Whisper large-v3 transcribes with the lowest error rates, as
 * ISO 639-1 codes. Whisper supports ~100 languages; these are the ones
 * worth putting one click away.
 */
const WELL_SUPPORTED = ["fr", "en", "es", "de", "pt", "it", "nl", "pl", "ja", "zh"] as const;

/**
 * Dictation-language picker. Unlike the interface language, this one is
 * part of the Rust `Settings`: the backend reads it at the start of every
 * transcription, so a change applies to the very next dictation.
 */
export function TranscriptionLanguageSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { t } = useI18n();
  const l = t.settings.language;

  // Each language named in itself ("Deutsch", "日本語"), like the interface
  // picker — someone looking for their language recognises it that way.
  const options = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: "auto", label: l.autoDetect },
      ...WELL_SUPPORTED.map((code) => ({ value: code, label: nativeName(code) })),
    ];
    // A code set elsewhere (older settings file) must still show as selected.
    if (!list.some((o) => o.value === value)) list.push({ value, label: nativeName(value) });
    return list;
  }, [l.autoDetect, value]);

  return (
    <LanguageRow
      id="dictation-language"
      label={t.ui.settings.dictation}
      hint={l.transcriptionLabel}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}

function nativeName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
}
