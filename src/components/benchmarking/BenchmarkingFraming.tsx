/**
 * Subtle authority framing for benchmarking/global-standard positioning.
 * Renders a single line of copy in a consistent, low-clutter style.
 * Use across patient, doctor, and clinic views for consistency.
 */

import {
  BENCHMARKING_GLOBAL_STANDARDS,
  BENCHMARKING_COMPARED,
  BENCHMARKING_PATTERN_ANALYSIS,
} from "@/lib/benchmarkingCopy";

export type BenchmarkingFramingPreset =
  | "global_standards"
  | "compared"
  | "pattern_analysis";

export type BenchmarkingFramingProps = {
  preset?: BenchmarkingFramingPreset;
  /** Optional custom line (overrides preset). */
  children?: React.ReactNode;
  /** Optional class for the wrapper. */
  className?: string;
  /** Dark (slate) vs light (default) context. */
  variant?: "dark" | "light";
};

const PRESET_MAP: Record<BenchmarkingFramingPreset, string> = {
  global_standards: BENCHMARKING_GLOBAL_STANDARDS,
  compared: BENCHMARKING_COMPARED,
  pattern_analysis: BENCHMARKING_PATTERN_ANALYSIS,
};

export default function BenchmarkingFraming({
  preset = "global_standards",
  children,
  className = "",
  variant = "dark",
}: BenchmarkingFramingProps) {
  const content = children ?? PRESET_MAP[preset];
  const textClass =
    variant === "light"
      ? "text-xs text-slate-500"
      : "text-xs text-slate-400";
  return (
    <p className={`${textClass} ${className}`.trim()}>
      {content}
    </p>
  );
}
