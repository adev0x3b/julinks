import { pageBackground, RADII, withAlpha, type ThemeTokens } from "@/lib/themes";

/** A tiny rendition of a theme: its background with one button-shaped bar. */
export function ThemeSwatch({ tokens, backgroundUrl }: { tokens: ThemeTokens; backgroundUrl: string | null }) {
  const overlay = withAlpha("#000000", tokens.overlay / 100);
  const background = backgroundUrl
    ? `linear-gradient(${overlay}, ${overlay}), url("${backgroundUrl}") center / cover, ${pageBackground(tokens)}`
    : pageBackground(tokens);
  const button = tokens.buttonStyle === "outline" ? "transparent" : tokens.buttonStyle === "glass" ? withAlpha(tokens.button, 0.2) : tokens.button;
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-black/10" style={{ background }} aria-hidden>
      <span
        className="block h-2.5 w-8"
        style={{ background: button, border: `1px solid ${tokens.buttonStyle === "solid" ? "transparent" : tokens.button}`, borderRadius: RADII[tokens.radius] }}
      />
    </span>
  );
}
