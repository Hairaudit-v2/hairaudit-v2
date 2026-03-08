type AreaScoreItem = {
  title: string;
  score: number;
};

type FindingLike = {
  title?: string;
  impact?: string;
  recommended_next_step?: string;
  evidence?: Array<{ observation?: string }>;
};

type OptionalStructuredFingerprint = {
  donor_extraction_pattern?: StructuredFingerprintDomain;
  recipient_site_distribution?: StructuredFingerprintDomain;
  hairline_transition_pattern?: StructuredFingerprintDomain;
  density_consistency_signature?: StructuredFingerprintDomain;
  direction_angle_coherence?: StructuredFingerprintDomain;
};

type StructuredFingerprintDomain = {
  label?: string;
  confidence?: "high" | "moderate" | "low";
  observation?: string;
  why_it_matters?: string;
};

export type FingerprintConfidence = "high" | "moderate" | "low";

export type SurgicalFingerprintCard = {
  key:
    | "donor_extraction_pattern"
    | "recipient_site_distribution"
    | "hairline_transition_pattern"
    | "density_consistency_signature"
    | "direction_angle_coherence";
  title: string;
  icon: string;
  label: string;
  confidence: FingerprintConfidence;
  observation: string;
  whyItMatters: string;
  limitation?: string;
  strength: number;
};

export function buildSurgicalFingerprintSummary(input: {
  areaDomains: AreaScoreItem[];
  sectionScores: AreaScoreItem[];
  findings: FindingLike[];
  highlights: string[];
  risks: string[];
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]>;
  confidence01?: number | null;
  surgicalFingerprint?: OptionalStructuredFingerprint | null;
}): { cards: SurgicalFingerprintCard[]; limitedEvidence: boolean } {
  const categories = Object.keys(input.photosByCategory ?? {}).map((x) => x.toLowerCase());
  const donorViews = categories.filter((x) => x.includes("donor")).length;
  const recipientViews = categories.filter((x) => x.includes("recipient")).length;
  const recipientDay0Views = categories.filter(
    (x) =>
      x.includes("recipient") &&
      (x.includes("day 0") || x.includes("day0") || x.includes("immediate") || x.includes("post-op"))
  ).length;
  const hairlineViews = categories.filter((x) => x.includes("hairline") || x.includes("front")).length;
  const intraViews = categories.filter((x) => x.includes("intra")).length;
  const totalPhotos = Object.values(input.photosByCategory ?? {})
    .flat()
    .filter((p) => !!p?.signedUrl).length;

  const confidence01 = Number.isFinite(Number(input.confidence01)) ? Number(input.confidence01) : 0.5;
  const scoreFor = (matches: string[]) => {
    const match = (s: string) => matches.some((m) => s.toLowerCase().includes(m));
    const domainScores = (input.areaDomains ?? []).filter((d) => match(d.title)).map((d) => d.score);
    if (domainScores.length) return domainScores.reduce((a, b) => a + b, 0) / domainScores.length;
    const sectionScores = (input.sectionScores ?? []).filter((s) => match(s.title)).map((s) => s.score);
    if (!sectionScores.length) return null;
    return sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length;
  };

  const findingText = [
    ...(input.findings ?? []).flatMap((f) => [
      String(f?.title ?? ""),
      String(f?.impact ?? ""),
      ...(Array.isArray(f?.evidence) ? f.evidence.map((e) => String(e?.observation ?? "")) : []),
    ]),
    ...(input.highlights ?? []).map((x) => String(x ?? "")),
    ...(input.risks ?? []).map((x) => String(x ?? "")),
  ]
    .join(" ")
    .toLowerCase();

  const fromStructured = (
    key: keyof OptionalStructuredFingerprint,
    fallback: Omit<SurgicalFingerprintCard, "key">
  ): Omit<SurgicalFingerprintCard, "key"> => {
    const row = input.surgicalFingerprint?.[key];
    if (!row) return fallback;
    return {
      ...fallback,
      label: String(row.label ?? fallback.label),
      confidence:
        row.confidence === "high" || row.confidence === "moderate" || row.confidence === "low"
          ? row.confidence
          : fallback.confidence,
      observation: String(row.observation ?? fallback.observation),
      whyItMatters: String(row.why_it_matters ?? fallback.whyItMatters),
    };
  };

  const confidenceByCoverage = (coverage: number, canClaimStrong: boolean): FingerprintConfidence => {
    if (!canClaimStrong) return "low";
    if (coverage >= 3 && confidence01 >= 0.75) return "high";
    if (coverage >= 2 && confidence01 >= 0.55) return "moderate";
    return "low";
  };

  const donorScore = scoreFor(["donor"]);
  const donorCanClaimStrong = donorViews >= 2;
  const donorLabel = !donorCanClaimStrong
    ? "Limited Evidence"
    : findingText.includes("patchy") || findingText.includes("overharvest") || findingText.includes("uneven")
      ? "Patchy / Uneven"
      : findingText.includes("cluster") || findingText.includes("concentrat")
        ? "Mildly Clustered"
        : donorScore != null && donorScore >= 78
          ? "Evenly Distributed"
          : "Mildly Clustered";
  const donorObservation =
    donorLabel === "Limited Evidence"
      ? "Assessment limited by available image quality or angle coverage. Available donor views are not sufficient for a stronger pattern call."
      : donorLabel === "Evenly Distributed"
        ? "Visible donor extraction spacing appears broadly even in the submitted views and is consistent with controlled spread, without clear concentrated depletion zones."
        : donorLabel === "Mildly Clustered"
          ? "Visual pattern suggests mild clustering in portions of the donor region, while overall spread appears partially preserved."
          : "Visual pattern suggests uneven extraction spread with localized concentration in the available donor views.";

  const recipientScore = scoreFor(["recipient", "implant", "site"]);
  const recipientCanClaimStrong = recipientDay0Views >= 1;
  const recipientLabel = !recipientCanClaimStrong
    ? "Limited Evidence"
    : findingText.includes("linear") || findingText.includes("structured")
      ? "Structured / Linear Pattern"
      : findingText.includes("row")
        ? "Mild Row Patterning"
        : recipientScore != null && recipientScore >= 78
          ? "Randomized Natural Pattern"
          : "Mild Row Patterning";
  const recipientObservation =
    recipientLabel === "Limited Evidence"
      ? "Assessment limited by available image quality or angle coverage. No clear day-0 recipient image was available for a stronger distribution interpretation."
      : recipientLabel === "Randomized Natural Pattern"
        ? "Recipient placement appears visually varied and non-linear across available zones, which appears consistent with a more natural distribution pattern."
        : recipientLabel === "Mild Row Patterning"
          ? "Recipient sites show mild row-like alignment in some zones, with mixed variability across the visible field."
          : "Recipient site distribution appears more structured and linear in visible zones than expected for softer randomization.";

  const hairlineCanClaimStrong = hairlineViews >= 1 && recipientViews >= 1;
  const hairlineScore = scoreFor(["hairline", "recipient", "naturalness"]);
  const hairlineLabel = !hairlineCanClaimStrong
    ? "Limited Evidence"
    : findingText.includes("abrupt") || findingText.includes("harsh")
      ? "Abrupt / Harsh Transition"
      : findingText.includes("moderate")
        ? "Moderately Defined"
        : hairlineScore != null && hairlineScore >= 78
          ? "Soft Transitional Edge"
          : "Moderately Defined";
  const hairlineObservation =
    hairlineLabel === "Limited Evidence"
      ? "Assessment limited by available image quality or angle coverage for frontal transition review."
      : hairlineLabel === "Soft Transitional Edge"
        ? "Frontal transition appears gradually blended in the available views, without a sharply demarcated border."
        : hairlineLabel === "Moderately Defined"
          ? "Hairline transition appears moderately defined, with partial softness and some visible edge distinction."
          : "Transition edge appears visually abrupt in the available frontal perspective, with reduced blending into adjacent zones.";

  const densityCanClaimStrong = recipientViews >= 2;
  const densityScore = scoreFor(["density", "implant", "recipient"]);
  const densityLabel = !densityCanClaimStrong
    ? "Limited Evidence"
    : findingText.includes("drop-off")
      ? "Mild Zone Drop-Off"
      : findingText.includes("uneven")
        ? "Uneven Zone Distribution"
        : densityScore != null && densityScore >= 78
          ? "Even Density Spread"
          : "Mild Zone Drop-Off";
  const densityObservation =
    densityLabel === "Limited Evidence"
      ? "Assessment limited by available image quality or angle coverage for cross-zone density comparison."
      : densityLabel === "Even Density Spread"
        ? "Density appearance is relatively balanced across visible recipient zones in the submitted perspectives."
        : densityLabel === "Mild Zone Drop-Off"
          ? "Density appears moderately variable between visible zones, with subtle drop-off in at least one region."
          : "Density pattern appears uneven between visible zones, suggesting stronger regional variability.";

  const directionCanClaimStrong = recipientViews >= 2 || intraViews >= 1;
  const directionScore = scoreFor(["angle", "direction", "recipient", "implant"]);
  const directionLabel = !directionCanClaimStrong
    ? "Limited Evidence"
    : findingText.includes("mismatch") || findingText.includes("inconsisten")
      ? "Noticeable Direction Mismatch"
      : directionScore != null && directionScore >= 80
        ? "Consistent with Native Flow"
        : directionScore != null && directionScore >= 65
          ? "Mild Direction Mismatch"
          : "Noticeable Direction Mismatch";
  const directionObservation =
    directionLabel === "Limited Evidence"
      ? "Assessment limited by available image quality or angle coverage for reliable direction and angulation interpretation."
      : directionLabel === "Consistent with Native Flow"
        ? "Visible orientation and directional flow appear broadly aligned with surrounding native hair direction in available views."
        : directionLabel === "Mild Direction Mismatch"
          ? "Some visible directional variance is present relative to nearby native flow, though mismatch appears limited."
          : "Directional flow appears noticeably variable from surrounding native orientation in available views.";

  const cards: SurgicalFingerprintCard[] = [
    {
      key: "donor_extraction_pattern",
      ...fromStructured("donor_extraction_pattern", {
        title: "Donor Extraction Pattern",
        icon: "◌",
        label: donorLabel,
        confidence: confidenceByCoverage(donorViews, donorCanClaimStrong),
        observation: donorObservation,
        whyItMatters:
          "This pattern may influence long-term donor appearance and perceived patchiness risk over time.",
        limitation:
          donorCanClaimStrong ? undefined : "Assessment limited by available image quality or angle coverage.",
        strength: Math.max(20, Math.min(100, Math.round((donorScore ?? 35) + donorViews * 8))),
      }),
    },
    {
      key: "recipient_site_distribution",
      ...fromStructured("recipient_site_distribution", {
        title: "Recipient Site Distribution",
        icon: "▦",
        label: recipientLabel,
        confidence: confidenceByCoverage(recipientViews, recipientCanClaimStrong),
        observation: recipientObservation,
        whyItMatters:
          "This pattern may influence perceived naturalness and how density appears across recipient zones.",
        limitation:
          recipientCanClaimStrong ? undefined : "Assessment limited by available image quality or angle coverage.",
        strength: Math.max(20, Math.min(100, Math.round((recipientScore ?? 35) + recipientViews * 8))),
      }),
    },
    {
      key: "hairline_transition_pattern",
      ...fromStructured("hairline_transition_pattern", {
        title: "Hairline Transition Pattern",
        icon: "∿",
        label: hairlineLabel,
        confidence: confidenceByCoverage(hairlineViews, hairlineCanClaimStrong),
        observation: hairlineObservation,
        whyItMatters:
          "This pattern may influence perceived softness and frontal naturalness at conversational distance.",
        limitation:
          hairlineCanClaimStrong ? undefined : "Assessment limited by available image quality or angle coverage.",
        strength: Math.max(20, Math.min(100, Math.round((hairlineScore ?? 35) + hairlineViews * 12))),
      }),
    },
    {
      key: "density_consistency_signature",
      ...fromStructured("density_consistency_signature", {
        title: "Density Consistency Signature",
        icon: "▤",
        label: densityLabel,
        confidence: confidenceByCoverage(recipientViews, densityCanClaimStrong),
        observation: densityObservation,
        whyItMatters:
          "This pattern may influence cosmetic balance and overall visual uniformity across zones.",
        limitation:
          densityCanClaimStrong ? undefined : "Assessment limited by available image quality or angle coverage.",
        strength: Math.max(20, Math.min(100, Math.round((densityScore ?? 35) + recipientViews * 9))),
      }),
    },
    {
      key: "direction_angle_coherence",
      ...fromStructured("direction_angle_coherence", {
        title: "Direction & Angle Coherence",
        icon: "↗",
        label: directionLabel,
        confidence: confidenceByCoverage(Math.max(recipientViews, intraViews), directionCanClaimStrong),
        observation: directionObservation,
        whyItMatters:
          "This pattern may influence how naturally grafted hair blends with surrounding native flow.",
        limitation:
          directionCanClaimStrong ? undefined : "Assessment limited by available image quality or angle coverage.",
        strength: Math.max(20, Math.min(100, Math.round((directionScore ?? 35) + (recipientViews + intraViews) * 6))),
      }),
    },
  ];

  const limitedEvidence = totalPhotos === 0 || cards.filter((c) => c.label === "Limited Evidence").length >= 3;
  return { cards, limitedEvidence };
}
