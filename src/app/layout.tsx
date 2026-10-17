import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "JuLinks", template: "%s · JuLinks" },
  description: "One page for all your links.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
