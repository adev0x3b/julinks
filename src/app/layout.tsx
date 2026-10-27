import type { Metadata } from "next";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";
import { appUrl } from "@/lib/app-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: appUrl(),
  title: { default: "JuLinks", template: "%s · JuLinks" },
  description: "One page for all your links.",
};

/** Applies the saved (or system) colour scheme before first paint, so a dark page never flashes white. */
const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The class is set by the script above, before React runs, so hydration must not complain about it.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
