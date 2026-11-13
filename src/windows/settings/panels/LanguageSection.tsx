import { ChevronDown } from "lucide-react";

import { UI_LOCALES, useI18n, type UiLocale } from "@/i18n";

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
    <LanguageRow
      id="ui-language"
      label={t.ui.settings.interface}
      hint={t.settings.language.uiHint}
      value={locale}
      onChange={(v) => setLocale(v as UiLocale)}
      options={UI_LOCALES.map((o) => ({ value: o.code, label: o.native }))}
    />
  );
}

/** Label + hint on the left, a compact native select on the right. */
export function LanguageRow({
  id,
  label,
  hint,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 space-y-0.5">
        <span className="block text-[12.5px] font-medium text-app">{label}</span>
        {hint && <span className="block text-[11px] text-muted leading-snug">{hint}</span>}
      </label>
      <span className="relative flex-shrink-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none min-w-[168px] h-[34px] pl-3 pr-8 rounded-[9px] border border-app bg-app text-[12.5px] text-app cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-soft"
          strokeWidth={2.2}
        />
      </span>
    </div>
  );
}
