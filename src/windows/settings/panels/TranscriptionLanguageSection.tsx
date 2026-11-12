import { useMemo } from "react";
import { Check } from "lucide-react";

import { useI18n } from "@/i18n";
import { SectionLabel } from "./common";

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
  const options = useMemo(
    () =>
      WELL_SUPPORTED.map((code) => ({
        code,
        label: nativeName(code),
      })),
    []
  );

  const rows: Array<{ code: string; label: string; sublabel?: string }> = [
    { code: "auto", label: l.autoDetect, sublabel: l.autoDetectSublabel },
    ...options,
  ];

  return (
    <section className="space-y-3">
      <SectionLabel>{l.transcriptionLabel}</SectionLabel>

      <div className="rounded-[10px] border border-app bg-elevated overflow-hidden">
        {rows.map((row, i) => {
          const active = row.code === value;
          return (
            <button
              key={row.code}
              type="button"
              onClick={() => onChange(row.code)}
              lang={row.code === "auto" ? undefined : row.code}
              aria-pressed={active}
              className={[
                "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                i > 0 ? "border-t border-soft" : "",
                active ? "bg-sand-soft" : "hover:bg-hover",
              ].join(" ")}
            >
              <span className="flex flex-col">
                <span
                  className={["text-[13px]", active ? "text-app font-medium" : "text-soft"].join(
                    " "
                  )}
                >
                  {row.label}
                </span>
                {row.sublabel && (
                  <span className="text-[11px] text-faint">{row.sublabel}</span>
                )}
              </span>

              {active && <Check size={15} className="text-sand shrink-0" />}
            </button>
          );
        })}
      </div>

      <p className="text-[11.5px] text-faint leading-relaxed">{l.transcriptionHint}</p>
    </section>
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
