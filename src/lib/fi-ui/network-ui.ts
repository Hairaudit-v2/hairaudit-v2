/**
 * Selective re-exports from the sibling Follicle Intelligence `packages/ui`.
 * Avoid importing the package root `index.ts` here so TypeScript does not pull in
 * optional surfaces (e.g. FAQ accordion) that depend on a second `@types/react` tree.
 */

export type { NetworkProductSlug } from "../../../../follicleintelligence/packages/ui/ecosystem";
export { NETWORK_PRODUCTS } from "../../../../follicleintelligence/packages/ui/ecosystem";

export { networkButtonVariants, type NetworkButtonProps } from "../../../../follicleintelligence/packages/ui/Button";
export { NetworkBadge as Badge, type NetworkBadgeProps, type NetworkBadgeTone } from "../../../../follicleintelligence/packages/ui/Badge";
export { NetworkCard as Card, type NetworkCardProps, type NetworkCardVariant } from "../../../../follicleintelligence/packages/ui/Card";
export { NetworkContainer as Container, type NetworkContainerProps } from "../../../../follicleintelligence/packages/ui/Container";
export { NetworkSection as Section, type NetworkSectionProps } from "../../../../follicleintelligence/packages/ui/Section";
export { Hero, type HeroProps } from "../../../../follicleintelligence/packages/ui/Hero";
export { NetworkHero, type NetworkHeroProps } from "../../../../follicleintelligence/packages/ui/NetworkHero";
export { NetworkFeatureGrid as FeatureGrid, type NetworkFeatureGridProps } from "../../../../follicleintelligence/packages/ui/FeatureGrid";
export { NetworkFeatureCard as FeatureCard, type NetworkFeatureCardProps } from "../../../../follicleintelligence/packages/ui/FeatureCard";
export { NetworkMetricCard as MetricCard, type NetworkMetricCardProps } from "../../../../follicleintelligence/packages/ui/MetricCard";
export { NetworkPlatformNav as PlatformNav, type NetworkPlatformNavProps } from "../../../../follicleintelligence/packages/ui/PlatformNav";
export {
  NetworkEcosystemFooter as EcosystemFooter,
  type NetworkEcosystemFooterProps,
  type LegalLink,
} from "../../../../follicleintelligence/packages/ui/EcosystemFooter";
export { NetworkProductPill as ProductPill, type NetworkProductPillProps } from "../../../../follicleintelligence/packages/ui/ProductPill";
export { NetworkCTASection, NetworkCTASection as CTASection, type NetworkCTASectionProps } from "../../../../follicleintelligence/packages/ui/CTASection";

export {
  NetworkProblemSolutionSection,
  type NetworkProblemSolutionSectionProps,
  type ProblemSolutionColumn,
} from "../../../../follicleintelligence/packages/ui/sections/ProblemSolutionSection";
export {
  NetworkIntelligenceLayerSection,
  type NetworkIntelligenceLayerSectionProps,
  type IntelligenceLayerItem,
} from "../../../../follicleintelligence/packages/ui/sections/IntelligenceLayerSection";
export {
  NetworkEcosystemMapSection,
  type NetworkEcosystemMapSectionProps,
} from "../../../../follicleintelligence/packages/ui/sections/EcosystemMapSection";
export {
  NetworkAudienceSection,
  type NetworkAudienceSectionProps,
  type AudienceSegment,
} from "../../../../follicleintelligence/packages/ui/sections/AudienceSection";

export * from "../../../../follicleintelligence/packages/ui/tokens";
