/**
 * FI-OUTCOME-INTELLIGENCE-1F — Database seed for browser E2E.
 *
 * Idempotent by external_case_id (FI-OI-1F:*). Uses canonical services for
 * projection / capture plan / observation / comparison payloads.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAuditCaseInsertData } from "@/lib/cases/createCase";
import { applyPatientPhotoCategoryFields } from "@/lib/uploads/patientPhotoCategoryIntegrity";
import { createSupabaseProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotPersist.server";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { createSupabaseLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCapturePersist.server";
import { createLongitudinalCapturePlanService } from "@/lib/outcomeIntelligence/longitudinalCaptureService";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { roleToPostopCategoryHint } from "@/lib/outcomeIntelligence/longitudinalCapturePolicy";
import { deriveNextAction } from "@/lib/outcomeIntelligence/longitudinalCaptureDto";
import { LONGITUDINAL_CAPTURE_WORKFLOW } from "@/lib/outcomeIntelligence/longitudinalFollowupUploadAllowance";
import type { LongitudinalEvidenceRole } from "@/lib/projection/types";
import {
  assertLongitudinalE2eFixturesAllowed,
  longitudinalE2eDisplayName,
  longitudinalE2eEmail,
  longitudinalE2eExternalCaseId,
  LONGITUDINAL_E2E_PASSWORD,
} from "./constants";
import { resetLongitudinalCaseLineage } from "./cleanup";
import { getManifestEntry, LONGITUDINAL_FIXTURE_MANIFEST } from "./manifest";
import {
  persistComparisonSnapshot,
  persistObservationSnapshot,
} from "./persistLineage";
import { seedLongitudinalProjectionFixture } from "./seedInMemory";
import {
  ensureSyntheticLongitudinalImages,
  roleToSyntheticImage,
  syntheticImagePath,
} from "./syntheticImages";
import { procedureDateForDueStage, captureTimestampForStage } from "./procedureDates";
import type {
  LongitudinalE2eCatalog,
  LongitudinalE2eCatalogEntry,
  SeedLongitudinalProjectionFixtureConfig,
} from "./types";
import * as fs from "node:fs";

const BUCKET = process.env.CASE_FILES_BUCKET || "case-files";

async function ensureFixtureUser(
  admin: SupabaseClient,
  fixtureKey: string
): Promise<{ userId: string; email: string }> {
  const email = longitudinalE2eEmail(fixtureKey);
  const password = LONGITUDINAL_E2E_PASSWORD;

  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (found?.id) {
      await admin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
        user_metadata: {
          role: "patient",
          is_test: true,
          longitudinal_e2e_fixture: fixtureKey,
        },
      });
      await admin.from("profiles").upsert({
        id: found.id,
        role: "patient",
        email,
        name: longitudinalE2eDisplayName(fixtureKey),
      });
      return { userId: found.id, email };
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "patient",
      is_test: true,
      longitudinal_e2e_fixture: fixtureKey,
    },
  });
  if (error || !data.user?.id) {
    throw new Error(`createUser failed for ${email}: ${error?.message ?? "no id"}`);
  }
  await admin.from("profiles").upsert({
    id: data.user.id,
    role: "patient",
    email,
    name: longitudinalE2eDisplayName(fixtureKey),
  });
  return { userId: data.user.id, email };
}

async function ensureFixtureCase(
  admin: SupabaseClient,
  args: { userId: string; fixtureKey: string; title: string }
): Promise<{ caseId: string; created: boolean }> {
  const externalCaseId = longitudinalE2eExternalCaseId(args.fixtureKey);
  const { data: existing } = await admin
    .from("cases")
    .select("id")
    .eq("external_case_id", externalCaseId)
    .maybeSingle();

  const submittedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = {
    ...buildAuditCaseInsertData(args.userId, "patient", "post_surgery"),
    user_id: args.userId,
    patient_id: args.userId,
    title: args.title,
    status: "submitted",
    submitted_at: submittedAt,
    is_test: true,
    external_case_id: externalCaseId,
  };

  if (existing?.id) {
    await resetLongitudinalCaseLineage(admin, existing.id as string);
    const { error } = await admin.from("cases").update(row).eq("id", existing.id);
    if (error) throw new Error(`case update failed: ${error.message}`);
    return { caseId: existing.id as string, created: false };
  }

  const { data, error } = await admin.from("cases").insert(row).select("id").single();
  if (error || !data?.id) {
    throw new Error(`case insert failed: ${error?.message ?? "no id"}`);
  }
  return { caseId: data.id as string, created: true };
}

async function persistUpload(
  admin: SupabaseClient,
  args: {
    caseId: string;
    userId: string;
    category: string;
    buffer: Buffer;
    stage: string;
    role: string;
    capturedAt: string;
  }
): Promise<void> {
  const storagePath = `cases/${args.caseId}/patient/${args.category}/fi-oi-1f-${Date.now()}-${args.role}.jpg`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, args.buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  const { type, metadata } = applyPatientPhotoCategoryFields(args.category, {
    original_name: `synthetic-${args.role}.jpg`,
    mime: "image/jpeg",
    size: args.buffer.length,
    capture_workflow: LONGITUDINAL_CAPTURE_WORKFLOW,
    capture_stage: args.stage,
    capture_role: args.role,
    longitudinal_e2e_fixture: true,
  });

  const { error: insErr } = await admin.from("uploads").insert({
    case_id: args.caseId,
    user_id: args.userId,
    type,
    storage_path: storagePath,
    metadata: {
      ...metadata,
      captured_at: args.capturedAt,
      client_capture_timestamp: args.capturedAt,
    },
  });
  if (insErr) throw new Error(`upload insert failed: ${insErr.message}`);
}

export async function seedLongitudinalE2eFixtureToDatabase(
  admin: SupabaseClient,
  fixtureKeyRaw: string,
  overrides?: Partial<SeedLongitudinalProjectionFixtureConfig>
): Promise<LongitudinalE2eCatalogEntry> {
  assertLongitudinalE2eFixturesAllowed();

  const fixtureKey = String(fixtureKeyRaw)
    .toUpperCase()
    .replace(/^FI-OI-1F-/, "");
  const manifest = getManifestEntry(fixtureKey);
  if (!manifest) {
    throw new Error(`Unknown longitudinal E2E fixture key: ${fixtureKey}`);
  }

  await ensureSyntheticLongitudinalImages();

  const { userId, email } = await ensureFixtureUser(admin, fixtureKey);
  const { caseId } = await ensureFixtureCase(admin, {
    userId,
    fixtureKey,
    title: manifest.displayName,
  });

  // Use real "now" so live guided-capture status matches browser time.
  const nowIso = overrides?.now ?? new Date().toISOString();
  const anchor = manifest.anchorStageForWindow ?? manifest.focusStage;
  const procedureDate =
    overrides?.procedureDate ??
    procedureDateForDueStage({ stage: anchor, now: nowIso });

  const memory = await seedLongitudinalProjectionFixture({
    fixtureKey,
    mode: manifest.mode,
    projectionMode: manifest.projectionMode,
    treatedAreas: manifest.treatedAreas,
    focusStage: manifest.focusStage,
    anchorStageForWindow: manifest.anchorStageForWindow,
    existingUploadRoles: manifest.existingUploadRoles,
    seedReferenceFront: manifest.seedReferenceFront,
    seedEngagement: manifest.seedEngagement,
    seedComparison: manifest.seedComparison,
    now: nowIso,
    procedureDate,
    caseId,
    patientId: userId,
    ...overrides,
  });

  const ownership = { id: caseId, patient_id: userId, user_id: userId };
  const projectionRepo = createSupabaseProjectionSnapshotRepository(admin);
  const snapService = createProjectionSnapshotService({
    repository: projectionRepo,
    loadCaseOwnership: async () => ownership,
  });

  // Re-freeze into Supabase using the same reconstruction/outcome from memory seed.
  const { reconstructionSnapshot, projectionSnapshot } = memory.projection;
  const dbProjection = await snapService.createProjectionSnapshot(
    {
      caseId,
      patientId: userId,
      reconstruction: reconstructionSnapshot,
      projectedOutcome: projectionSnapshot,
      id: memory.projection.id,
      now: memory.projection.createdAt,
    },
    { caseRow: ownership }
  );
  if (!dbProjection.ok) {
    throw new Error(`DB projection seed failed: ${dbProjection.reason}`);
  }

  // Persist follow-up uploads for incomplete/ready/observed modes (browser sees them).
  let uploadRoles: LongitudinalEvidenceRole[] = [];
  if (overrides?.existingUploadRoles) {
    uploadRoles = [...overrides.existingUploadRoles];
  } else if (manifest.mode === "seed-to-due") {
    uploadRoles = [];
  } else if (manifest.existingUploadRoles?.length) {
    uploadRoles = [...manifest.existingUploadRoles];
  } else if (
    manifest.mode === "seed-to-ready" ||
    manifest.mode === "seed-to-observed"
  ) {
    uploadRoles =
      memory.plan.milestones.find((m) => m.stage === manifest.focusStage)
        ?.requiredEvidenceRoles ?? [];
  }

  for (const role of uploadRoles) {
    const category = roleToPostopCategoryHint(manifest.focusStage, role);
    if (!category) continue;
    const imgRole = roleToSyntheticImage(role);
    const buf = fs.readFileSync(syntheticImagePath(imgRole));
    await persistUpload(admin, {
      caseId,
      userId,
      category,
      buffer: buf,
      stage: manifest.focusStage,
      role,
      capturedAt: captureTimestampForStage({
        procedureDate,
        stage: manifest.focusStage,
      }),
    });
  }

  if (manifest.seedReferenceFront) {
    const buf = fs.readFileSync(syntheticImagePath("front"));
    await persistUpload(admin, {
      caseId,
      userId,
      category: "day0_recipient",
      buffer: buf,
      stage: "surgery_day",
      role: "reference_front",
      capturedAt: `${procedureDate}T10:00:00.000Z`,
    });
  }

  const { data: uploadRows } = await admin
    .from("uploads")
    .select("id, type, created_at, captured_at, metadata")
    .eq("case_id", caseId);

  const captureRepo = createSupabaseLongitudinalCapturePlanRepository(admin);
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();

  if (memory.observation) {
    await persistObservationSnapshot(admin, {
      ...memory.observation,
      caseId,
      patientId: userId,
      projectionSnapshotId: dbProjection.snapshot.id,
    });
    await observationRepo.insert({
      ...memory.observation,
      caseId,
      patientId: userId,
      projectionSnapshotId: dbProjection.snapshot.id,
    });
  }
  if (memory.comparison && memory.observation) {
    await persistComparisonSnapshot(admin, {
      ...memory.comparison,
      caseId,
      patientId: userId,
      projectionSnapshotId: dbProjection.snapshot.id,
      observationSnapshotId: memory.observation.id,
    });
    await comparisonRepo.insert({
      ...memory.comparison,
      caseId,
      patientId: userId,
      projectionSnapshotId: dbProjection.snapshot.id,
      observationSnapshotId: memory.observation.id,
    });
  }

  const captureService = createLongitudinalCapturePlanService({
    capturePlanRepository: captureRepo,
    projectionRepository: projectionRepo,
    observationRepository: observationRepo,
    comparisonRepository: comparisonRepo,
    loadCaseOwnership: async () => ownership,
  });

  const resolved = await captureService.resolveCapturePlan({
    projectionSnapshotId: dbProjection.snapshot.id,
    caseId,
    patientId: userId,
    uploads: (uploadRows ?? []).map((u) => ({
      id: String((u as { id: string }).id),
      type: (u as { type?: string | null }).type ?? null,
      created_at: (u as { created_at?: string | null }).created_at ?? null,
      captured_at: (u as { captured_at?: string | null }).captured_at ?? null,
      metadata:
        ((u as { metadata?: Record<string, unknown> | null }).metadata as
          | Record<string, unknown>
          | null) ?? null,
    })),
    ensurePlan: true,
    now: nowIso,
    caseRow: ownership,
  });
  if (!resolved.ok) {
    throw new Error(`DB capture plan failed: ${resolved.reason}`);
  }

  const milestone = resolved.plan.milestones.find(
    (m) => m.stage === manifest.focusStage
  );
  const captureHref = milestone
    ? deriveNextAction({
        status: milestone.status,
        stage: milestone.stage,
        caseId,
        reviewAvailable: milestone.reviewAvailable,
        missingRequiredCount: milestone.missingRequiredEvidenceRoles.length,
      }).href
    : `/cases/${caseId}/patient/follow-up/${manifest.focusStage}`;

  return {
    fixtureKey,
    externalCaseId: longitudinalE2eExternalCaseId(fixtureKey),
    email,
    password: LONGITUDINAL_E2E_PASSWORD,
    caseId,
    patientId: userId,
    projectionSnapshotId: dbProjection.snapshot.id,
    observationSnapshotId: memory.observation?.id ?? null,
    comparisonSnapshotId: memory.comparison?.id ?? null,
    focusStage: manifest.focusStage,
    captureHref: memory.captureHref ?? captureHref,
    mode: manifest.mode,
  };
}

export async function seedAllLongitudinalE2eFixtures(
  admin: SupabaseClient,
  keys?: string[]
): Promise<LongitudinalE2eCatalog> {
  assertLongitudinalE2eFixturesAllowed();
  const selected = keys?.length
    ? LONGITUDINAL_FIXTURE_MANIFEST.filter((m) =>
        keys.map((k) => k.toUpperCase().replace(/^FI-OI-1F-/, "")).includes(m.fixtureKey)
      )
    : LONGITUDINAL_FIXTURE_MANIFEST;

  const entries: LongitudinalE2eCatalogEntry[] = [];
  for (const m of selected) {
    const entry = await seedLongitudinalE2eFixtureToDatabase(admin, m.fixtureKey);
    entries.push(entry);
    console.log(
      `[longitudinal-e2e] seeded ${m.fixtureKey} case=${entry.caseId} mode=${entry.mode}`
    );
  }

  const byKey: Record<string, LongitudinalE2eCatalogEntry> = {};
  for (const e of entries) byKey[e.fixtureKey] = e;
  return { entries, byKey };
}
