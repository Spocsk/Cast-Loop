"use client";

import clsx from "clsx";
import { ThemePreference, useTheme } from "@/components/providers/theme-provider";
import { Dropdown } from "@/components/ui/dropdown";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
}> = [
  { value: "system", label: "Système", hint: "Suit le thème de l'appareil" },
  { value: "light", label: "Clair", hint: "Palette lumineuse Cast Loop" },
  { value: "dark", label: "Sombre", hint: "Contraste renforcé pour cockpit" }
];

export function ThemeSwitcher({
  invert = false,
  className
}: {
  invert?: boolean;
  className?: string;
}) {
  const { preference, resolvedTheme, setPreference } = useTheme();

  const handleThemeChange = (nextValue: string) => {
    if (nextValue === "system" || nextValue === "light" || nextValue === "dark") {
      setPreference(nextValue);
    }
  };

  return (
    <section className={clsx("theme-switcher", invert && "theme-switcher--invert", className)}>
      <div className="theme-switcher-copy">
        <span className="eyebrow">Apparence</span>
        <strong>Thème de l’interface</strong>
        <p>
          {preference === "system"
            ? `Suit actuellement le mode ${resolvedTheme === "dark" ? "sombre" : "clair"} du système.`
            : `Le mode ${preference === "dark" ? "sombre" : "clair"} est forcé sur ce navigateur.`}
        </p>
      </div>

      <Dropdown
        options={themeOptions}
        value={preference}
        onChange={handleThemeChange}
        label="Choisir le thème de l’interface"
        kicker="Mode"
        invert={invert}
      />
    </section>
  );
}
