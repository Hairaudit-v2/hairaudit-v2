"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import {
  buildClinicalEvidenceGalleryModel,
  buildClinicalEvidenceUploadDescriptors,
  type ClinicalEvidenceImage,
} from "@/lib/reports/clinicalEvidenceGallery";
import { uploadSignedUrlFetchPath } from "@/lib/uploads/uploadSignedUrlClient";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
};

type SignedUrlMap = Record<string, string | null>;

export default function ClinicalEvidenceReviewGallery({
  uploads,
  caseId,
  titleKey,
  subtitleKey,
  noPhotoKey,
}: {
  uploads: UploadRow[];
  caseId: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  noPhotoKey: TranslationKey;
}) {
  const { t } = useI18n();
  const [signed, setSigned] = useState<SignedUrlMap>({});

  const descriptors = useMemo(() => buildClinicalEvidenceUploadDescriptors(uploads), [uploads]);

  useEffect(() => {
    let active = true;

    async function loadSignedUrls() {
      const entries = await Promise.all(
        descriptors.map(async (descriptor) => {
          const upload = uploads.find((u) => u.id === descriptor.id);
          if (!upload?.storage_path) return [descriptor.id, null] as const;
          try {
            const res = await fetch(uploadSignedUrlFetchPath(upload.storage_path, caseId));
            const json = await res.json().catch(() => ({}));
            return [descriptor.id, json?.url ?? null] as const;
          } catch {
            return [descriptor.id, null] as const;
          }
        })
      );
      if (!active) return;
      setSigned(Object.fromEntries(entries));
    }

    if (descriptors.length > 0) loadSignedUrls();
    return () => {
      active = false;
    };
  }, [caseId, descriptors, uploads]);

  const images: ClinicalEvidenceImage[] = useMemo(
    () =>
      descriptors.map((descriptor) => ({
        id: descriptor.id,
        imageUrl: signed[descriptor.id] ?? null,
        label: descriptor.label,
        categoryKey: descriptor.categoryKey,
      })),
    [descriptors, signed]
  );

  const model = buildClinicalEvidenceGalleryModel(images, "web", {
    evidenceProcessedPrefix: "Evidence Processed",
    evidenceProcessedSuffix: "clinical images reviewed during analysis.",
  });

  if (images.length === 0) return null;

  return (
    <div
      data-testid="clinical-evidence-review-gallery"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900">{t(titleKey)}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(subtitleKey)}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {model.displayedImages.map((img) => (
          <div
            key={img.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            {img.imageUrl ? (
              <div className="aspect-[4/3] bg-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.label}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slate-500">
                {t(noPhotoKey)}
              </div>
            )}
            <div className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {img.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {model.additionalReviewedLine ? (
        <p className="mt-4 text-sm font-semibold text-slate-800">{model.additionalReviewedLine}</p>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-800">Evidence Processed:</span>{" "}
          {model.totalCount} clinical images reviewed during analysis.
        </p>
        <p className="mt-1">
          This independent assessment incorporates all submitted visual evidence.
        </p>
      </div>
    </div>
  );
}
