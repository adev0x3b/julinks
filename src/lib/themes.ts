/** Visual themes for public pages. Pure data so both server and client can import it. */
export type Theme = {
  id: string;
  name: string;
  /** Page background (CSS). */
  background: string;
  /** Text colour for name and bio. */
  text: string;
  /** Secondary text colour. */
  muted: string;
  /** Link button background. */
  button: string;
  /** Link button text. */
  buttonText: string;
  /** Link button border radius. */
  radius: string;
  /** Hover transform / shadow. */
  buttonHover: string;
};

export const THEMES = [
  {
    id: "midnight",
    name: "Midnight",
    background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)",
    text: "#f8fafc",
    muted: "#a5b4fc",
    button: "rgba(255,255,255,0.08)",
    buttonText: "#f8fafc",
    radius: "9999px",
    buttonHover: "rgba(255,255,255,0.16)",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    background: "linear-gradient(160deg, #fff7ed 0%, #fecdd3 100%)",
    text: "#431407",
    muted: "#9a3412",
    button: "#fb923c",
    buttonText: "#431407",
    radius: "14px",
    buttonHover: "#f97316",
  },
  {
    id: "forest",
    name: "Forest",
    background: "linear-gradient(160deg, #052e16 0%, #14532d 100%)",
    text: "#ecfdf5",
    muted: "#86efac",
    button: "#166534",
    buttonText: "#ecfdf5",
    radius: "6px",
    buttonHover: "#15803d",
  },
  {
    id: "paper",
    name: "Paper",
    background: "#fafaf9",
    text: "#1c1917",
    muted: "#57534e",
    button: "#ffffff",
    buttonText: "#1c1917",
    radius: "4px",
    buttonHover: "#f5f5f4",
  },
  {
    id: "neon",
    name: "Neon",
    background: "#09090b",
    text: "#fafafa",
    muted: "#a3e635",
    button: "transparent",
    buttonText: "#a3e635",
    radius: "0px",
    buttonHover: "rgba(163,230,53,0.15)",
  },
] as const satisfies readonly Theme[];

export const THEME_IDS = THEMES.map((t) => t.id) as [Theme["id"], ...Theme["id"][]];

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "midnight";

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
