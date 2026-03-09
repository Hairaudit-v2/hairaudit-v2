"use client";

import { useState, useCallback } from "react";
import { BadgeWidget } from "@/components/clinic-profile";

type ClinicBadgeWidgetSectionProps = {
  eligible: boolean;
  profileUrl: string;
  slug: string;
  clinicName: string;
  currentAwardTier: string | null;
  participationStatus: string | null;
  baseUrl: string;
};

function CopyButton({ label, onCopy }: { label: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleClick = useCallback(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export default function ClinicBadgeWidgetSection({
  eligible,
  profileUrl,
  slug,
  clinicName,
  currentAwardTier,
  participationStatus,
  baseUrl,
}: ClinicBadgeWidgetSectionProps) {
  const badgeUrlCompact = `${baseUrl}/clinics/${slug}/badge?variant=compact`;
  const badgeUrlFull = `${baseUrl}/clinics/${slug}/badge?variant=full`;

  const simpleBadgeHtml = `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">HairAudit verified clinic</a>`;
  const iframeCompact = `<iframe src="${badgeUrlCompact}" width="320" height="80" frameborder="0" title="HairAudit verification badge"></iframe>`;
  const iframeFull = `<iframe src="${badgeUrlFull}" width="280" height="220" frameborder="0" title="HairAudit verification badge"></iframe>`;

  const copyProfileLink = useCallback(() => {
    void navigator.clipboard.writeText(profileUrl);
  }, [profileUrl]);

  const copyBadgeHtml = useCallback(() => {
    void navigator.clipboard.writeText(simpleBadgeHtml);
  }, [simpleBadgeHtml]);

  const copyIframeCompact = useCallback(() => {
    void navigator.clipboard.writeText(iframeCompact);
  }, [iframeCompact]);

  const copyIframeFull = useCallback(() => {
    void navigator.clipboard.writeText(iframeFull);
  }, [iframeFull]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        HairAudit Badge &amp; Verification Widget
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Display your HairAudit recognition and link visitors to your public
        evidence-backed clinic profile.
      </p>

      {!eligible ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-medium text-amber-900">Badge not available yet</p>
          <p className="mt-2 text-sm text-amber-800">
            To show the verification badge and embed widget:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
            <li>Make your clinic profile public</li>
            <li>Assign a clinic slug (URL-friendly identifier)</li>
            <li>Ensure you have a recognition tier (e.g. Verified, Silver, Gold, Platinum)</li>
          </ul>
          <p className="mt-3 text-sm text-amber-700">
            Once these are set, this section will show a live badge preview and embed code.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Live badge preview
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <div>
                <p className="text-xs text-slate-500 mb-1">Compact</p>
                <div className="rounded-lg border border-slate-200 bg-[#0a0a0f] p-4 inline-block">
                  <BadgeWidget
                    clinicName={clinicName}
                    clinicSlug={slug}
                    currentAwardTier={currentAwardTier}
                    participationStatus={participationStatus}
                    variant="compact"
                    style="dark"
                    linkToProfile={false}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Full</p>
                <div className="rounded-lg border border-slate-200 bg-[#0a0a0f] p-4 inline-block">
                  <BadgeWidget
                    clinicName={clinicName}
                    clinicSlug={slug}
                    currentAwardTier={currentAwardTier}
                    participationStatus={participationStatus}
                    variant="full"
                    style="dark"
                    linkToProfile={false}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Public profile URL
            </p>
            <code className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 break-all">
              {profileUrl}
            </code>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Public Profile
              </a>
              <CopyButton label="Copy profile link" onCopy={copyProfileLink} />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Simple linked badge (HTML)
            </p>
            <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto">
              {simpleBadgeHtml}
            </pre>
            <div className="mt-2">
              <CopyButton label="Copy badge HTML" onCopy={copyBadgeHtml} />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              iframe embed (compact)
            </p>
            <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto">
              {iframeCompact}
            </pre>
            <div className="mt-2">
              <CopyButton label="Copy iframe embed" onCopy={copyIframeCompact} />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              iframe embed (full)
            </p>
            <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto">
              {iframeFull}
            </pre>
            <div className="mt-2">
              <CopyButton label="Copy iframe embed (full)" onCopy={copyIframeFull} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
