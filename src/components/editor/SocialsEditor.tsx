"use client";

import { useState, useTransition } from "react";
import { saveSocials } from "@/actions/profile";
import { MAX_SOCIALS, SOCIAL_PLATFORM_IDS, SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/socials";
import { moveItem } from "@/lib/reorder";

export type SocialDraft = { platform: SocialPlatformId; value: string };

/**
 * The icon row under the bio: platform + handle/address/URL per row, reordered
 * with the arrows and saved as a whole. The preview updates as you type.
 */
export function SocialsEditor({ rows, onChange }: { rows: SocialDraft[]; onChange: (next: SocialDraft[]) => void }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(index: number, changes: Partial<SocialDraft>) {
    setSaved(false);
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function save() {
    setErrors({});
    setError(null);
    startTransition(async () => {
      const result = await saveSocials(rows);
      if (result.ok) {
        onChange(result.socials.map(({ platform, value }) => ({ platform, value })));
        setSaved(true);
      } else {
        setErrors(result.errors);
        setError(result.error ?? null);
      }
    });
  }

  return (
    <div className="mt-5 border-t border-stone-200 pt-5" data-testid="socials-editor">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="label mb-0">Social icons</p>
        <span className="text-xs text-stone-400">Shown under your bio</span>
      </div>
      {rows.length === 0 && <p className="mb-3 text-sm text-stone-500">No icons yet. Add Instagram, email, your site…</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const platform = SOCIAL_PLATFORMS[row.platform];
          return (
            <li key={index} className="flex flex-wrap items-start gap-2" data-testid="social-row">
              <select
                className="input w-auto shrink-0"
                value={row.platform}
                onChange={(ev) => update(index, { platform: ev.target.value as SocialPlatformId })}
                aria-label={`Platform of icon ${index + 1}`}
              >
                {SOCIAL_PLATFORM_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SOCIAL_PLATFORMS[id].label}
                  </option>
                ))}
              </select>
              <div className="min-w-40 flex-1">
                <input
                  className="input"
                  value={row.value}
                  placeholder={platform.placeholder}
                  maxLength={200}
                  onChange={(ev) => update(index, { value: ev.target.value })}
                  aria-label={`${platform.label} handle or URL`}
                  aria-invalid={errors[index] ? true : undefined}
                />
                {errors[index] && (
                  <p className="error" role="alert">
                    {errors[index]}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="btn-ghost px-2" disabled={index === 0} onClick={() => onChange(moveItem(rows, index, index - 1))} aria-label={`Move ${platform.label} up`}>
                  ↑
                </button>
                <button type="button" className="btn-ghost px-2" disabled={index === rows.length - 1} onClick={() => onChange(moveItem(rows, index, index + 1))} aria-label={`Move ${platform.label} down`}>
                  ↓
                </button>
                <button type="button" className="btn-ghost px-2 text-red-600 hover:text-red-700" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remove ${platform.label} icon`}>
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="error mt-2" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={rows.length >= MAX_SOCIALS}
          onClick={() => {
            setSaved(false);
            onChange([...rows, { platform: rows.length === 0 ? "instagram" : "email", value: "" }]);
          }}
        >
          Add icon
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save icons"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-green-700" role="status">
            Icons saved
          </span>
        )}
      </div>
    </div>
  );
}
