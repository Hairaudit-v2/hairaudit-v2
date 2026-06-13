/**
 * Selective re-exports from the vendored Follicle Intelligence Network UI
 * (`packages/fi-network-ui`). Keeps HairAudit builds self-contained for CI/Vercel.
 */

export type { NetworkProductSlug } from "../../../packages/fi-network-ui/ecosystem";
export { NETWORK_PRODUCTS } from "../../../packages/fi-network-ui/ecosystem";

export { networkButtonVariants, type NetworkButtonProps } from "../../../packages/fi-network-ui/Button";
export { NetworkBadge as Badge, type NetworkBadgeProps, type NetworkBadgeTone } from "../../../packages/fi-network-ui/Badge";
export { NetworkCard as Card, type NetworkCardProps, type NetworkCardVariant } from "../../../packages/fi-network-ui/Card";
export { NetworkContainer as Container, type NetworkContainerProps } from "../../../packages/fi-network-ui/Container";
export { NetworkSection as Section, type NetworkSectionProps } from "../../../packages/fi-network-ui/Section";
export { Hero, type HeroProps } from "../../../packages/fi-network-ui/Hero";
export { NetworkHero, type NetworkHeroProps } from "../../../packages/fi-network-ui/NetworkHero";
export { NetworkFeatureGrid as FeatureGrid, type NetworkFeatureGridProps } from "../../../packages/fi-network-ui/FeatureGrid";
export { NetworkFeatureCard as FeatureCard, type NetworkFeatureCardProps } from "../../../packages/fi-network-ui/FeatureCard";
export { NetworkMetricCard as MetricCard, type NetworkMetricCardProps } from "../../../packages/fi-network-ui/MetricCard";
export { NetworkPlatformNav as PlatformNav, type NetworkPlatformNavProps } from "../../../packages/fi-network-ui/PlatformNav";
export {
  NetworkEcosystemFooter as EcosystemFooter,
  type NetworkEcosystemFooterProps,
  type LegalLink,
} from "../../../packages/fi-network-ui/EcosystemFooter";
export { NetworkProductPill as ProductPill, type NetworkProductPillProps } from "../../../packages/fi-network-ui/ProductPill";
export { NetworkCTASection, NetworkCTASection as CTASection, type NetworkCTASectionProps } from "../../../packages/fi-network-ui/CTASection";

export {
  NetworkProblemSolutionSection,
  type NetworkProblemSolutionSectionProps,
  type ProblemSolutionColumn,
} from "../../../packages/fi-network-ui/sections/ProblemSolutionSection";
export {
  NetworkIntelligenceLayerSection,
  type NetworkIntelligenceLayerSectionProps,
  type IntelligenceLayerItem,
} from "../../../packages/fi-network-ui/sections/IntelligenceLayerSection";
export {
  NetworkEcosystemMapSection,
  type NetworkEcosystemMapSectionProps,
} from "../../../packages/fi-network-ui/sections/EcosystemMapSection";
export {
  NetworkAudienceSection,
  type NetworkAudienceSectionProps,
  type AudienceSegment,
} from "../../../packages/fi-network-ui/sections/AudienceSection";

export * from "../../../packages/fi-network-ui/tokens";
