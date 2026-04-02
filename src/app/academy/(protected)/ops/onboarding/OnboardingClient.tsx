"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTrainingAcademyRosterRequestEmail,
  buildMailtoTrainingAcademyHrefForInbox,
} from "@/lib/academy/onboardingTemplate";

type Row = { email: string; academy_role: "trainer" | "clinic_staff" | "trainee"; display_name: string };

const emptyRow = (): Row => ({ email: "", academy_role: "trainee", display_name: "" });

type SiteOption = { id: string; name: string; slug: string; display_name: string | null };
type ProgramOption = { id: string; name: string; academy_site_id: string | null };
type DoctorOption = { id: string; full_name: string; program_id: string | null };

type RouteMode = "training_doctor" | "training_program" | "academy_site" | "env_only";

type RecipientState =
  | { kind: "idle" }
  | { kind: "incomplete"; message: string }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; payload: ResolvePayload };

type ResolvePayload = {
  email: string | null;
  source: string;
  route: string | null;
  siteLabel: string | null;
  siteSlug: string | null;
};

function routeModeLabel(m: RouteMode): string {
  switch (m) {
    case "training_doctor":
      return "Trainee (training doctor)";
    case "training_program":
      return "Training program";
    case "academy_site":
      return "Academy site";
    case "env_only":
      return "Global env fallback only";
    default:
      return m;
  }
}

function sourceDescription(source: string): string {
  switch (source) {
    case "site_ops":
      return "academy_sites.ops_notification_email";
    case "env_fallback":
      return "ACADEMY_OPS_NOTIFICATION_EMAIL";
    case "none":
      return "Not configured";
    default:
      return source;
  }
}

export default function OnboardingClient({
  envFallbackConfigured,
  sites,
  programs,
  doctors,
  defaultHairauditAdminEmail,
}: {
  envFallbackConfigured: boolean;
  sites: SiteOption[];
  programs: ProgramOption[];
  doctors: DoctorOption[];
  defaultHairauditAdminEmail: string;
}) {
  const [tab, setTab] = useState<"template" | "email" | "provision">("template");
  const [copied, setCopied] = useState<string | null>(null);

  const [routeMode, setRouteMode] = useState<RouteMode>("training_program");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState(() => programs[0]?.id ?? "");
  const [selectedSiteId, setSelectedSiteId] = useState(() => sites[0]?.id ?? "");
  const [recipient, setRecipient] = useState<RecipientState>({ kind: "idle" });

  const [trainingSiteOrProgram, setTrainingSiteOrProgram] = useState("");
  const [hairauditAdminName, setHairauditAdminName] = useState("");
  const [hairauditAdminEmail, setHairauditAdminEmail] = useState(defaultHairauditAdminEmail);
  const [notesForAcademy, setNotesForAcademy] = useState("");
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [provMsg, setProvMsg] = useState<string | null>(null);
  const [provBusy, setProvBusy] = useState(false);
  const [lastResults, setLastResults] = useState<
    Array<{ email: string; academy_role: string; ok: boolean; method?: string; error?: string; manualLink?: string }>
  >([]);

  const routingQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (routeMode === "training_doctor" && selectedDoctorId) p.set("trainingDoctorId", selectedDoctorId);
    if (routeMode === "training_program" && selectedProgramId) p.set("trainingProgramId", selectedProgramId);
    if (routeMode === "academy_site" && selectedSiteId) p.set("academySiteId", selectedSiteId);
    return p.toString();
  }, [routeMode, selectedDoctorId, selectedProgramId, selectedSiteId]);

  const notifyPayloadIds = useMemo(
    () => ({
      trainingDoctorId: routeMode === "training_doctor" ? selectedDoctorId || null : null,
      trainingProgramId: routeMode === "training_program" ? selectedProgramId || null : null,
      academySiteId: routeMode === "academy_site" ? selectedSiteId || null : null,
    }),
    [routeMode, selectedDoctorId, selectedProgramId, selectedSiteId]
  );

  useEffect(() => {
    if (routeMode === "training_doctor" && !selectedDoctorId) {
      setRecipient({ kind: "incomplete", message: "Select a trainee (training doctor) to resolve the inbox." });
      return;
    }
    if (routeMode === "training_program" && !selectedProgramId) {
      setRecipient({
        kind: "incomplete",
        message: programs.length ? "Select a training program." : "No programs yet — add one or use another routing option.",
      });
      return;
    }
    if (routeMode === "academy_site" && !selectedSiteId) {
      setRecipient({
        kind: "incomplete",
        message: sites.length ? "Select an academy site." : "No academy sites yet — create one under Sites or use env fallback.",
      });
      return;
    }

    const ac = new AbortController();
    setRecipient({ kind: "loading" });

    (async () => {
      try {
        const qs = routingQuery ? `?${routingQuery}` : "";
        const res = await fetch(`/api/academy/onboarding/resolve-recipient${qs}`, { signal: ac.signal });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Could not resolve recipient");
        const payload: ResolvePayload = {
          email: j.email ?? null,
          source: j.source ?? "none",
          route: j.route ?? null,
          siteLabel: j.siteLabel ?? null,
          siteSlug: j.siteSlug ?? null,
        };
        setRecipient({ kind: "ready", payload });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setRecipient({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not resolve recipient",
        });
      }
    })();

    return () => ac.abort();
  }, [routingQuery, routeMode, selectedDoctorId, selectedProgramId, selectedSiteId, programs.length, sites.length]);

  const mailtoInbox =
    recipient.kind === "ready" ? (recipient.payload.email ?? "").trim() : "";

  const templatePreview = useMemo(() => {
    return buildTrainingAcademyRosterRequestEmail({
      trainingSiteOrProgram: trainingSiteOrProgram || "[Program / site / cohort name]",
      hairauditAdminName: hairauditAdminName || "[Your name]",
      hairauditAdminEmail: hairauditAdminEmail || "[you@hairaudit.com]",
      notesForAcademy: notesForAcademy || undefined,
    });
  }, [trainingSiteOrProgram, hairauditAdminName, hairauditAdminEmail, notesForAcademy]);

  const mailtoHref = useMemo(
    () =>
      buildMailtoTrainingAcademyHrefForInbox(mailtoInbox, {
        trainingSiteOrProgram: trainingSiteOrProgram || "—",
        hairauditAdminName: hairauditAdminName || "—",
        hairauditAdminEmail: hairauditAdminEmail || "—",
        notesForAcademy: notesForAcademy || undefined,
      }),
    [mailtoInbox, trainingSiteOrProgram, hairauditAdminName, hairauditAdminEmail, notesForAcademy]
  );

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  async function sendNotify() {
    setNotifyBusy(true);
    setNotifyMsg(null);
    try {
      const res = await fetch("/api/academy/onboarding/notify-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingSiteOrProgram,
          hairauditAdminName,
          hairauditAdminEmail,
          notesForAcademy: notesForAcademy || undefined,
          ...notifyPayloadIds,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Request failed");
      setNotifyMsg(
        `Sent to ${j.sentTo ?? "training academy inbox"}. When they reply with the roster, use step 3 to create logins.`
      );
    } catch (e) {
      setNotifyMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function runProvision() {
    setProvBusy(true);
    setProvMsg(null);
    setLastResults([]);
    const entries = rows
      .filter((r) => r.email.trim())
      .map((r) => ({
        email: r.email.trim(),
        academy_role: r.academy_role,
        display_name: r.display_name.trim() || undefined,
      }));
    if (entries.length === 0) {
      setProvMsg("Add at least one email.");
      setProvBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/academy/onboarding/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Provision failed");
      setLastResults(j.results ?? []);
      const failed = (j.results ?? []).filter((x: { ok: boolean }) => !x.ok).length;
      setProvMsg(failed ? `Done with ${failed} error(s). Review results below.` : "All entries processed.");
    } catch (e) {
      setProvMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setProvBusy(false);
    }
  }

  const canSendResend =
    recipient.kind === "ready" &&
    Boolean(recipient.payload.email?.trim()) &&
    trainingSiteOrProgram.trim() &&
    hairauditAdminName.trim() &&
    hairauditAdminEmail.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            ["template", "1. How it works"],
            ["email", "2. Email training academy"],
            ["provision", "3. Create logins"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === id ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "template" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 text-sm text-slate-700">
          <p>
            <strong>You (HairAudit academy admin)</strong> send the request to the <strong>training academy</strong>{" "}
            (IIOHR / Evolved) so <em>they</em> complete the official roster. When they email you back with the list, use
            step 3 to generate invites and magic links — HairAudit does not guess emails on behalf of the clinic.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-slate-600">
            <li>
              In step 2, choose how to <strong>route</strong> the message (trainee → program site → ops inbox, or pick a
              program/site directly, or fall back to the global env inbox).
            </li>
            <li>Confirm the resolved destination inbox, then send or copy the email.</li>
            <li>Wait for their reply with one line per person: <code className="text-xs bg-slate-100 px-1">role, email, name</code>.</li>
            <li>Enter those rows in step 3 and run <strong>Invite / link users</strong>.</li>
          </ol>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>
              <strong>trainer</strong> → HairAudit profile <code className="text-xs bg-slate-100 px-1">doctor</code>, Academy{" "}
              <code className="text-xs bg-slate-100 px-1">trainer</code>
            </li>
            <li>
              <strong>clinic_staff</strong> → profile <code className="text-xs bg-slate-100 px-1">clinic</code>, Academy{" "}
              <code className="text-xs bg-slate-100 px-1">clinic_staff</code>
            </li>
            <li>
              <strong>trainee</strong> → profile <code className="text-xs bg-slate-100 px-1">patient</code>, Academy{" "}
              <code className="text-xs bg-slate-100 px-1">trainee</code> + <code className="text-xs bg-slate-100 px-1">training_doctors</code> row
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Per-site ops inboxes: manage under{" "}
            <Link href="/academy/sites" className="text-amber-800 font-medium hover:underline">
              Academy sites
            </Link>
            . Global fallback: <code>ACADEMY_OPS_NOTIFICATION_EMAIL</code>
            {envFallbackConfigured ? (
              <span className="text-emerald-700"> (set)</span>
            ) : (
              <span className="text-amber-800"> (not set — configure a site inbox or set this env var)</span>
            )}
          </p>
        </section>
      ) : null}

      {tab === "email" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-sm text-slate-600">
            This message is sent <strong>from HairAudit</strong> to the training academy, asking them to return the roster.
            Routing picks the recipient inbox from the trainee&apos;s program/site, a program, a site, or the env fallback.
          </p>

          <fieldset className="rounded-lg border border-slate-200 p-3 space-y-2">
            <legend className="text-xs font-semibold text-slate-600 px-1">Recipient routing</legend>
            <div className="flex flex-col gap-2 text-sm">
              {(
                [
                  ["training_program", "By training program (uses program → linked academy site)"],
                  ["training_doctor", "By trainee (uses doctor override → program → site)"],
                  ["academy_site", "By academy site directly"],
                  ["env_only", "Global env fallback only (ACADEMY_OPS_NOTIFICATION_EMAIL)"],
                ] as const
              ).map(([value, help]) => (
                <label key={value} className="flex gap-2 items-start cursor-pointer">
                  <input
                    type="radio"
                    name="routeMode"
                    checked={routeMode === value}
                    onChange={() => setRouteMode(value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-slate-800">{routeModeLabel(value)}</span>
                    <span className="block text-xs text-slate-500">{help}</span>
                  </span>
                </label>
              ))}
            </div>

            {routeMode === "training_doctor" ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Trainee (training doctor)</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                      {d.program_id ? ` · program linked` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {routeMode === "training_program" ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Training program</label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {programs.length === 0 ? <option value="">No programs</option> : null}
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {routeMode === "academy_site" ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Academy site</label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {sites.length === 0 ? <option value="">No sites</option> : null}
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name?.trim() || s.name} ({s.slug})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </fieldset>

          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              recipient.kind === "ready" && recipient.payload.email
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : recipient.kind === "loading"
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-amber-200 bg-amber-50/80 text-amber-950"
            }`}
          >
            <div className="font-semibold text-slate-900">Resolved destination (before send)</div>
            {recipient.kind === "loading" ? <p className="mt-1">Resolving inbox…</p> : null}
            {recipient.kind === "incomplete" ? <p className="mt-1">{recipient.message}</p> : null}
            {recipient.kind === "error" ? <p className="mt-1 text-red-800">{recipient.message}</p> : null}
            {recipient.kind === "ready" ? (
              <div className="mt-1 space-y-1">
                <p>
                  <span className="text-slate-600">To:</span>{" "}
                  <code className="text-sm bg-white/80 px-1 py-0.5 rounded border border-emerald-200/80">
                    {recipient.payload.email?.trim() || "— (no inbox — set site ops email or env fallback)"}
                  </code>
                </p>
                <p className="text-xs text-slate-600">
                  Source: <strong>{sourceDescription(recipient.payload.source)}</strong>
                  {recipient.payload.siteLabel ? (
                    <>
                      {" "}
                      · Site: <strong>{recipient.payload.siteLabel}</strong>
                      {recipient.payload.siteSlug ? ` (${recipient.payload.siteSlug})` : ""}
                    </>
                  ) : null}
                  {recipient.payload.route ? (
                    <>
                      {" "}
                      · Route: <strong>{recipient.payload.route}</strong>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Program / site / cohort (shown in subject &amp; body)</label>
              <input
                value={trainingSiteOrProgram}
                onChange={(e) => setTrainingSiteOrProgram(e.target.value)}
                placeholder="e.g. Evolved Fellowship Cohort Q2 · City Clinic"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Your name (HairAudit)</label>
              <input
                value={hairauditAdminName}
                onChange={(e) => setHairauditAdminName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Your work email (HairAudit)</label>
              <input
                type="email"
                value={hairauditAdminEmail}
                onChange={(e) => setHairauditAdminEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Notes for the academy (optional)</label>
              <textarea
                value={notesForAcademy}
                onChange={(e) => setNotesForAcademy(e.target.value)}
                rows={3}
                placeholder="e.g. Please include all trainers and fellows starting 1 May."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(templatePreview.body, "body")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {copied === "body" ? "Copied" : "Copy email body"}
            </button>
            <button
              type="button"
              onClick={() => copy(templatePreview.subject, "sub")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {copied === "sub" ? "Copied" : "Copy subject"}
            </button>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open in email app
              </a>
            ) : (
              <span className="text-xs text-amber-800 self-center">
                Mailto needs a resolved inbox (configure site or ACADEMY_OPS_NOTIFICATION_EMAIL).
              </span>
            )}
            <button
              type="button"
              disabled={notifyBusy || !canSendResend}
              onClick={sendNotify}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {notifyBusy ? "Sending…" : "Send via HairAudit (Resend)"}
            </button>
          </div>
          {notifyMsg ? <p className="text-sm text-slate-600">{notifyMsg}</p> : null}

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 mb-1">
              Preview (to:{" "}
              {recipient.kind === "ready"
                ? recipient.payload.email?.trim() || "—"
                : recipient.kind === "loading"
                  ? "…"
                  : "—"}
              )
            </div>
            <div className="font-medium">{templatePreview.subject}</div>
            <pre className="mt-2 whitespace-pre-wrap font-mono">{templatePreview.body}</pre>
          </div>
        </section>
      ) : null}

      {tab === "provision" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-sm text-slate-600">
            After the <strong>training academy</strong> replies with their completed roster, paste each person here. New
            users get a Supabase <strong>invite</strong>; existing users get a <strong>magic link</strong> via Resend (or a
            one-time link to copy if email is not configured).
          </p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-12 items-end border-b border-slate-100 pb-2">
                <div className="sm:col-span-5">
                  <label className="text-xs text-slate-500">Email</label>
                  <input
                    value={r.email}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], email: e.target.value };
                      setRows(next);
                    }}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="name@clinic.com"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs text-slate-500">Academy role</label>
                  <select
                    value={r.academy_role}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], academy_role: e.target.value as Row["academy_role"] };
                      setRows(next);
                    }}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="trainer">Trainer (surgeon / faculty)</option>
                    <option value="clinic_staff">Clinic coordinator / nurse</option>
                    <option value="trainee">Trainee</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="text-xs text-slate-500">Display name</label>
                  <input
                    value={r.display_name}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], display_name: e.target.value };
                      setRows(next);
                    }}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Dr. Name"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRows([...rows, emptyRow()])}
              className="text-sm font-medium text-amber-800 hover:underline"
            >
              + Add row
            </button>
            <button
              type="button"
              disabled={provBusy}
              onClick={runProvision}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {provBusy ? "Working…" : "Invite / link users"}
            </button>
          </div>
          {provMsg ? <p className="text-sm text-slate-700">{provMsg}</p> : null}
          {lastResults.length > 0 ? (
            <ul className="text-sm space-y-2 border-t border-slate-100 pt-3">
              {lastResults.map((r, i) => (
                <li key={i} className={r.ok ? "text-emerald-800" : "text-red-800"}>
                  {r.email} — {r.academy_role} — {r.ok ? `OK (${r.method})` : r.error}
                  {r.manualLink ? (
                    <div className="mt-1 break-all text-xs text-slate-600">
                      Resend not configured — share this link once: {r.manualLink}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
