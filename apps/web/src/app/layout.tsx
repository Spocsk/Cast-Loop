import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Cast Loop",
  description: "Pilotage editorial multi-tenant pour agences et marques.",
  icons: {
    icon: "/assets/cast-loop-logo.png",
    shortcut: "/assets/cast-loop-logo.png",
    apple: "/assets/cast-loop-logo.png"
  }
};

const themeInitScript = `
(() => {
  try {
    const storageKey = "cast-loop-theme";
    const root = document.documentElement;
    const storedPreference = window.localStorage.getItem(storageKey);
    const preference =
      storedPreference === "light" || storedPreference === "dark" || storedPreference === "system"
        ? storedPreference
        : "system";
    const resolvedTheme =
      preference === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : preference;

    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="light" data-theme-preference="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable}`}>
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
