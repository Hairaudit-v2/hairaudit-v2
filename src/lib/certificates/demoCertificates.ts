/**
 * Demo certificate data for display and homepage section.
 * One clinic per tier; all carry isSample: true for watermark.
 * Static v1: no persistence.
 */

import type { CertificateData } from "./types";
import { toCertificateTier } from "./types";

const DEMO_ISSUED = "2025-03-01T00:00:00.000Z";

export const DEMO_CERTIFICATES: CertificateData[] = [
  {
    clinicName: "Nordic Hair Institute",
    tier: toCertificateTier("PLATINUM"),
    score: 96.2,
    caseCount: 24,
    issuedAt: DEMO_ISSUED,
    certificateId: "HA-DEMO-PLAT-001",
    isSample: true,
  },
  {
    clinicName: "Mediterranean Restoration Clinic",
    tier: toCertificateTier("GOLD"),
    score: 88.5,
    caseCount: 18,
    issuedAt: DEMO_ISSUED,
    certificateId: "HA-DEMO-GOLD-002",
    isSample: true,
  },
  {
    clinicName: "Central European Hair Centre",
    tier: toCertificateTier("SILVER"),
    score: 79.0,
    caseCount: 12,
    issuedAt: DEMO_ISSUED,
    certificateId: "HA-DEMO-SLV-003",
    isSample: true,
  },
  {
    clinicName: "Atlantic Transparency Clinic",
    tier: toCertificateTier("VERIFIED"),
    score: 72.0,
    caseCount: 6,
    issuedAt: DEMO_ISSUED,
    certificateId: "HA-DEMO-VER-004",
    isSample: true,
  },
];
