"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createThemeFromPreset, publishTheme, removeTheme, saveTheme, setActiveTheme } from "@/actions/themes";
import { PhoneFrame } from "@/components/PhoneFrame";
import { PublicProfile, type PublicFolder, type PublicLink } from "@/components/PublicProfile";
import type { SocialIcon } from "@/lib/socials";
import type { ImageFocus } from "@/lib/validation";
import { DEFAULT_PRESET, PRESETS, pageBackground, type ThemeTokens } from "@/lib/themes";
import { ThemeBuilder } from "./ThemeBuilder";
import { ThemeSwatch } from "./ThemeSwatch";

export type StudioTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
  backgroundUrl: string | null;
  isPublic: boolean;
  forkedFromId: string | null;
};

export type StudioUser = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarFocus: ImageFocus;
  socials: SocialIcon[];
  folders: PublicFolder[];
};

/**
 * The appearance page: your saved themes, the presets to start from, and a
 * builder for the selected theme with the live preview of your own page.
 * Server data comes in as props; every change calls an action, then
 * router.refresh() brings the new state back down.
 */
export function ThemeStudio({
  user,
  links,
  themes,
  activeId,
  initialSelectedId,
  notice,
}: {
  user: StudioUser;
  links: PublicLink[];
  themes: StudioTheme[];
  activeId: string | null;
  initialSelectedId: string | null;
  notice: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? activeId);
  const [error, setError] = useState<string | null>(notice);
  const [draft, setDraft] = useState<{ name: string; tokens: ThemeTokens } | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);

  const selected = themes.find((t) => t.id === selectedId) ?? themes.find((t) => t.id === activeId) ?? themes[0] ?? null;
  // A new selection starts a fresh draft from the server's copy of that theme.
  if (selected && draftFor !== selected.id) {
    setDraftFor(selected.id);
    setDraft({ name: selected.name, tokens: selected.tokens });
  }

  const refresh = () => startTransition(() => router.refresh());

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setError(null);
        after?.();
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  function startFromPreset(presetId: string) {
    startTransition(async () => {
      const result = await createThemeFromPreset(presetId);
      if (result.ok) {
        setError(null);
        setSelectedId(result.themeId);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const previewTheme =
    selected && draft
      ? { name: draft.name, tokens: draft.tokens, backgroundUrl: selected.backgroundUrl }
      : { name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundUrl: null };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {error && (
          <p className="error mt-0 rounded-lg bg-red-50 p-3" role="alert">
            {error}
          </p>
        )}

        <section className="card">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-semibold">Your themes</h2>
            <Link href="/themes" className="text-sm text-brand-600 hover:underline">
              Browse the gallery
            </Link>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            {themes.length === 0
              ? "Your page uses the default look. Start from a preset below to make it yours."
              : "Select a theme to edit it. The active one is what visitors see."}
          </p>
          {themes.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="theme-list">
              {themes.map((theme) => {
                const isActive = theme.id === activeId;
                const isSelected = theme.id === selected?.id;
                return (
                  <li
                    key={theme.id}
                    className={`rounded-xl border p-3 transition ${isSelected ? "border-brand-500 ring-2 ring-brand-100" : "border-stone-200"}`}
                    data-testid="theme-card"
                  >
                    <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setSelectedId(theme.id)}>
                      <ThemeSwatch tokens={theme.tokens} backgroundUrl={theme.backgroundUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{theme.name}</span>
                        <span className="block text-xs text-stone-500">
                          {isActive ? "Active" : "Saved"}
                          {theme.isPublic ? " · Public" : ""}
                        </span>
                      </span>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {!isActive && (
                        <button
                          type="button"
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => run(() => setActiveTheme(theme.id))}
                          disabled={pending}
                          aria-label={`Use ${theme.name}`}
                        >
                          Use
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => run(() => publishTheme(theme.id, !theme.isPublic))}
                        disabled={pending}
                        aria-label={`${theme.isPublic ? "Unpublish" : "Publish"} ${theme.name}`}
                      >
                        {theme.isPublic ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`Delete "${theme.name}"?`)) run(() => removeTheme(theme.id));
                        }}
                        disabled={pending}
                        aria-label={`Delete ${theme.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="text-base font-semibold">Start from a preset</h2>
          <p className="mb-4 text-sm text-stone-500">Creates a theme of your own and switches your page to it.</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="flex items-center gap-2 rounded-full border border-stone-300 py-1.5 pl-1.5 pr-3 text-sm transition hover:bg-stone-50 disabled:opacity-60"
                onClick={() => startFromPreset(preset.id)}
                disabled={pending}
              >
                <span className="size-6 rounded-full border border-black/10" style={{ background: pageBackground(preset.tokens) }} aria-hidden />
                {preset.name}
              </button>
            ))}
          </div>
        </section>

        {selected && draft && (
          <ThemeBuilder
            key={selected.id}
            theme={selected}
            draft={draft}
            onDraft={setDraft}
            onSave={() => saveTheme(selected.id, draft)}
            onBackgroundChanged={refresh}
          />
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="label text-center">Live preview</p>
        <div className="mx-auto w-full max-w-[320px]">
          <PhoneFrame>
            <PublicProfile
              preview
              profile={{
                username: user.username,
                displayName: user.displayName,
                bio: user.bio,
                avatarUrl: user.avatarUrl,
                avatarFocus: user.avatarFocus,
                theme: previewTheme,
                socials: user.socials,
                folders: user.folders,
                links,
              }}
            />
          </PhoneFrame>
        </div>
      </aside>
    </div>
  );
}
