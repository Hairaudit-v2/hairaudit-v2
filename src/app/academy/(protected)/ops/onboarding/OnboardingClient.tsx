"use client";

import { useMemo, useState } from "react";
import {
  buildTrainingAcademyRosterRequestEmail,
  buildMailtoTrainingAcademyHrefForInbox,
} from "@/lib/academy/onboardingTemplate";

type Row = { email: string; academy_role: "trainer" | "clinic_staff" | "trainee"; display_name: string };

const emptyRow = (): Row => ({ email: "", academy_role: "trainee", display_name: "" });

export default function OnboardingClient({
  opsInboxConfigured,
  trainingAcademyInbox,
  defaultHairauditAdminEmail,
}: {
  opsInboxConfigured: boolean;
  trainingAcademyInbox: string;
  defaultHairauditAdminEmail: string;
}) {
  const [tab, setTab] = useState<"template" | "email" | "provision">("template");
  const [copied, setCopied] = useState<string | null>(null);

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
      buildMailtoTrainingAcademyHrefForInbox(trainingAcademyInbox, {
        trainingSiteOrProgram: trainingSiteOrProgram || "—",
        hairauditAdminName: hairauditAdminName || "—",
        hairauditAdminEmail: hairauditAdminEmail || "—",
        notesForAcademy: notesForAcademy || undefined,
      }),
    [trainingAcademyInbox, trainingSiteOrProgram, hairauditAdminName, hairauditAdminEmail, notesForAcademy]
  );

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

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
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Request failed");
      setNotifyMsg("Sent to the training academy inbox. When they reply with the roster, use step 3 to create logins.");
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
            <li>Fill step 2 and send (or copy) the email to the academy inbox configured below.</li>
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
            Training academy inbox (env): <code>ACADEMY_OPS_NOTIFICATION_EMAIL</code>
            {opsInboxConfigured ? (
              <span className="text-emerald-700"> (set)</span>
            ) : (
              <span className="text-amber-800"> (not set — copy/paste email only)</span>
            )}
          </p>
        </section>
      ) : null}

      {tab === "email" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-sm text-slate-600">
            This message is sent <strong>from HairAudit</strong> to the training academy, asking them to return the roster.
          </p>
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
              <span className="text-xs text-amber-800 self-center">Set ACADEMY_OPS_NOTIFICATION_EMAIL for mailto.</span>
            )}
            {opsInboxConfigured ? (
              <button
                type="button"
                disabled={notifyBusy}
                onClick={sendNotify}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {notifyBusy ? "Sending…" : "Send via HairAudit (Resend)"}
              </button>
            ) : null}
          </div>
          {notifyMsg ? <p className="text-sm text-slate-600">{notifyMsg}</p> : null}

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 mb-1">Preview (to: {trainingAcademyInbox || "—"})</div>
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
                    <option value="trainer">Trainer</option>
                    <option value="clinic_staff">Clinic staff</option>
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
