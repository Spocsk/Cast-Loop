import clsx from "clsx";
import { FacebookGlyph, InstagramGlyph, LinkedinGlyph } from "./icons";

const tones: Record<string, string> = {
  facebook: "provider-facebook",
  instagram: "provider-instagram",
  linkedin: "provider-linkedin"
};

export function ProviderPill({ provider }: { provider: string }) {
  return (
    <span className={clsx("provider-pill", tones[provider])}>
      {providerIcon(provider)}
      {provider}
    </span>
  );
}

const providerIcon = (provider: string) => {
  switch (provider) {
    case "facebook":
      return <FacebookGlyph />;
    case "instagram":
      return <InstagramGlyph />;
    case "linkedin":
      return <LinkedinGlyph />;
    default:
      return null;
  }
};
