import type { CSSProperties } from "react";

/**
 * A theme is a small set of design tokens stored as JSON on a `themes` row.
 * Pure data and pure functions here so the server (public page), the client
 * (live preview, theme studio) and the tests share one definition.
 */
export const RADII = {
  none: "0px",
  small: "6px",
  medium: "14px",
  pill: "9999px",
} as const;

export const FONTS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manrope, system-ui, sans-serif',
} as const;

export const BUTTON_STYLES = ["solid", "outline", "glass"] as const;
/** Depth of the link buttons: none, the light drop shadow, or a dark outline with an offset hard shadow. */
export const SHADOWS = ["flat", "soft", "hard"] as const;
/** The outline and offset shadow of "hard" buttons: near-black reads on light and dark themes alike. */
const HARD_INK = "#111111";

export type Radius = keyof typeof RADII;
export type Font = keyof typeof FONTS;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type Shadow = (typeof SHADOWS)[number];

export type ThemeTokens = {
  /** Page background colour (#rrggbb). */
  background: string;
  /** Second colour of a diagonal gradient, or null for a flat background. */
  backgroundEnd: string | null;
  /** Name, bio and link text. */
  text: string;
  /** Handle, captions, empty state. */
  muted: string;
  /** Link button colour; how it is used depends on buttonStyle. */
  button: string;
  buttonText: string;
  buttonStyle: ButtonStyle;
  /** Missing on themes saved before it existed: those keep the look they had, "soft". */
  shadow?: Shadow;
  radius: Radius;
  font: Font;
  /** Darkening (0 to 90 percent) laid over a background image to keep text readable. */
  overlay: number;
};

export type Preset = { id: string; name: string; tokens: ThemeTokens };

/** The built-in starting points. Immutable; users copy one into their own theme and edit the copy. */
export const PRESETS: readonly Preset[] = [
  {
    id: "midnight",
    name: "Midnight",
    tokens: {
      background: "#0f172a",
      backgroundEnd: "#1e1b4b",
      text: "#f8fafc",
      muted: "#a5b4fc",
      button: "#ffffff",
      buttonText: "#f8fafc",
      buttonStyle: "glass",
      radius: "pill",
      font: "sans",
      overlay: 30,
    },
  },
  {
    id: "sunrise",
    name: "Sunrise",
    tokens: {
      background: "#fff7ed",
      backgroundEnd: "#fecdd3",
      text: "#431407",
      muted: "#9a3412",
      button: "#fb923c",
      buttonText: "#431407",
      buttonStyle: "solid",
      radius: "medium",
      font: "rounded",
      overlay: 20,
    },
  },
  {
    id: "forest",
    name: "Forest",
    tokens: {
      background: "#052e16",
      backgroundEnd: "#14532d",
      text: "#ecfdf5",
      muted: "#86efac",
      button: "#166534",
      buttonText: "#ecfdf5",
      buttonStyle: "solid",
      radius: "small",
      font: "serif",
      overlay: 40,
    },
  },
  {
    id: "paper",
    name: "Paper",
    tokens: {
      background: "#fafaf9",
      backgroundEnd: null,
      text: "#1c1917",
      muted: "#57534e",
      button: "#1c1917",
      buttonText: "#1c1917",
      buttonStyle: "outline",
      radius: "none",
      font: "serif",
      overlay: 10,
    },
  },
  {
    id: "neon",
    name: "Neon",
    tokens: {
      background: "#09090b",
      backgroundEnd: null,
      text: "#fafafa",
      muted: "#a3e635",
      button: "#a3e635",
      buttonText: "#a3e635",
      buttonStyle: "outline",
      radius: "none",
      font: "mono",
      overlay: 50,
    },
  },
  {
    id: "mint-pop",
    name: "Mint Pop",
    tokens: {
      background: "#5b3a55",
      backgroundEnd: "#7a4f70",
      text: "#fdf2f8",
      muted: "#f5d0fe",
      button: "#d9fff4",
      buttonText: "#312e81",
      buttonStyle: "solid",
      shadow: "hard",
      radius: "pill",
      font: "serif",
      overlay: 20,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export const HEX_COLOUR = /^#[0-9a-f]{6}$/;

/** `#rrggbb` plus an alpha channel, as 8-digit hex. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** Perceived luminance, 0 (black) to 1 (white), for choosing readable defaults. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function pageBackground(tokens: ThemeTokens): string {
  return tokens.backgroundEnd
    ? `linear-gradient(160deg, ${tokens.background} 0%, ${tokens.backgroundEnd} 100%)`
    : tokens.background;
}

type ThemeVars = CSSProperties & Record<`--jl-${string}`, string>;

/**
 * Everything the public page needs, as CSS custom properties on its root
 * element. Values are built only from validated tokens (hex colours, enum
 * keys, a bounded number) and an image URL the app generated itself, so no
 * user-controlled string ever reaches a style attribute unchecked.
 */
export function themeStyle(tokens: ThemeTokens, backgroundImageUrl: string | null = null): ThemeVars {
  const base = pageBackground(tokens);
  const overlay = withAlpha("#000000", tokens.overlay / 100);
  const background = backgroundImageUrl
    ? `linear-gradient(${overlay}, ${overlay}), url("${backgroundImageUrl}") center / cover no-repeat, ${base}`
    : base;
  const button = {
    solid: { bg: tokens.button, border: "transparent", shadow: "0 1px 2px rgba(0,0,0,0.12)" },
    outline: { bg: "transparent", border: tokens.button, shadow: "none" },
    glass: { bg: withAlpha(tokens.button, 0.12), border: withAlpha(tokens.button, 0.3), shadow: "none" },
  }[tokens.buttonStyle];
  const shadow = tokens.shadow ?? "soft";
  const depth =
    shadow === "hard"
      ? { border: HARD_INK, width: "2px", shadow: `4px 4px 0 ${HARD_INK}` }
      : { border: button.border, width: "1px", shadow: shadow === "flat" ? "none" : button.shadow };
  return {
    "--jl-bg": background,
    "--jl-text": tokens.text,
    "--jl-muted": tokens.muted,
    "--jl-btn-bg": button.bg,
    "--jl-btn-border": depth.border,
    "--jl-btn-border-width": depth.width,
    "--jl-btn-shadow": depth.shadow,
    "--jl-btn-text": tokens.buttonText,
    "--jl-radius": RADII[tokens.radius],
    "--jl-font": FONTS[tokens.font],
  };
}
