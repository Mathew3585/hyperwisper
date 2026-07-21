import { Check } from "lucide-react";

import { UI_LOCALES, useI18n, type UiLocale } from "@/i18n";
import { SectionLabel } from "./common";

/**
 * Interface-language picker.
 *
 * The choice is applied immediately and stored in localStorage — it is a
 * front-end preference, not part of the Rust `Settings` payload, so changing
 * it never touches the backend or the dictation pipeline.
 */
export function LanguageSection() {
  const { locale, setLocale, t } = useI18n();

  return (
    <section className="space-y-3">
      <SectionLabel>{t.settings.language.uiLabel}</SectionLabel>

      <div className="rounded-[10px] border border-app bg-elevated overflow-hidden">
        {UI_LOCALES.map((option, i) => {
          const active = option.code === locale;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => setLocale(option.code as UiLocale)}
              lang={option.code}
              aria-pressed={active}
              className={[
                "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                i > 0 ? "border-t border-soft" : "",
                active ? "bg-sand-soft" : "hover:bg-hover",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[13px]",
                  active ? "text-app font-medium" : "text-soft",
                ].join(" ")}
              >
                {option.native}
              </span>

              {active && <Check size={15} className="text-sand shrink-0" />}
            </button>
          );
        })}
      </div>

      <p className="text-[11.5px] text-faint leading-relaxed">
        {t.settings.language.uiHint}
      </p>
    </section>
  );
}
