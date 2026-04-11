import clsx from "clsx";

const tones: Record<string, string> = {
  facebook: "provider-pill provider-facebook",
  instagram: "provider-pill provider-instagram",
  linkedin: "provider-pill provider-linkedin"
};

export function ProviderPill({ provider }: { provider: string }) {
  return <span className={clsx("provider-pill", tones[provider])}>{provider}</span>;
}
