"use client";

import {
  type NetworkVariant,
  type NodeLinks,
} from "./constants";
import EcosystemDiagramAnimated, {
  type EcosystemDiagramSite,
} from "@/components/EcosystemDiagramAnimated";

export type GlobalHairIntelligenceNetworkProps = {
  /** Current site — this node is highlighted and not a link. */
  variant: NetworkVariant;
  /** Override node URLs; defaults to DEFAULT_NODE_LINKS. */
  nodeLinks?: Partial<NodeLinks>;
  /** Visual theme for nodes. "light" for soft light section background. */
  theme?: "light" | "dark";
  /** When true, show a background behind the diagram (e.g. boxed SVG). Default false. */
  showBackground?: boolean;
  /** Optional class for the wrapper. */
  className?: string;
};

export default function GlobalHairIntelligenceNetwork({
  variant,
  nodeLinks: nodeLinksOverride,
  theme = "light",
  showBackground = false,
  className = "",
}: GlobalHairIntelligenceNetworkProps) {
  const currentSite: EcosystemDiagramSite =
    variant === "fi" ? "follicleintelligence" : variant;

  const wrapperClass = [
    "relative w-full min-h-[320px] overflow-visible",
    showBackground
      ? theme === "light"
        ? "rounded-2xl border border-slate-200 bg-white"
        : "rounded-2xl border border-white/10 bg-white/[0.03]"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={wrapperClass}
      data-has-custom-links={nodeLinksOverride ? "true" : "false"}
    >
      <EcosystemDiagramAnimated
        currentSite={currentSite}
        theme={theme}
        static
        hideSupportingCopy
        className="!py-0 !px-0 !border-0 !bg-transparent"
      />
    </div>
  );
}
