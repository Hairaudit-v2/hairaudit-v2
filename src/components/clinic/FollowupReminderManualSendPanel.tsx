"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FollowupReminderDraft } from "@/lib/audit/followupReminderDraftsFromReadiness";
import type { FollowupReminderSendLogRow } from "@/lib/audit/followupReminderSendPayload";
import {
  createSingleFlightLock,
  FOLLOWUP_REMINDER_DELIVERABLE_CHANNELS,
} from "@/lib/audit/followupReminderSendPayload";

type Props = {
  caseId: string;
  drafts: FollowupReminderDraft[];
  initialLog: FollowupReminderSendLogRow[];
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function FollowupReminderManualSendPanel({ caseId, drafts, initialLog }: Props) {
  const [log, setLog] = useState<FollowupReminderSendLogRow[]>(initialLog);
  const [selectedKey, setSelectedKey] = useState<string>(() => drafts[0]?.milestoneId ?? "");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(() => drafts[0]?.patientMessageDraft ?? "");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const flightRef = useRef<ReturnType<typeof createSingleFlightLock> | null>(null);
  if (flightRef.current === null) flightRef.current = createSingleFlightLock();
  const flight = flightRef.current;

  const selectedDraft = drafts.find((d) => d.milestoneId === selectedKey) ?? null;

  useEffect(() => {
    setLog(initialLog);
  }, [initialLog]);

  useEffect(() => {
    if (!drafts.length) {
      setSelectedKey("");
      setBody("");
      return;
    }
    const nextKey = drafts.some((d) => d.milestoneId === selectedKey) ? selectedKey : drafts[0]!.milestoneId;
    if (nextKey !== selectedKey) setSelectedKey(nextKey);
    const d = drafts.find((x) => x.milestoneId === nextKey);
    if (d) {
      setBody(d.patientMessageDraft);
      setSubject("");
    }
  }, [drafts, selectedKey]);

  const onDraftChange = useCallback(
    (milestoneId: string) => {
      setSelectedKey(milestoneId);
      const d = drafts.find((x) => x.milestoneId === milestoneId);
      if (d) {
        setBody(d.patientMessageDraft);
        setSubject("");
      }
      setBanner(null);
    },
    [drafts]
  );

  const onSend = async () => {
    if (sending) return;
    if (!flight.tryEnter()) return;
    const d = selectedDraft;
    if (!d) {
      flight.exit();
      setBanner({ kind: "err", text: "Select a reminder draft to send." });
      return;
    }
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch("/api/clinic-portal/followup-reminder-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          milestoneId: d.milestoneId,
          channel: FOLLOWUP_REMINDER_DELIVERABLE_CHANNELS[0],
          recipient: recipient.trim(),
          subject: subject.trim() || null,
          body: body.trim(),
          draftSchemaVersion: d.metadata.schemaVersion,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        delivered?: boolean;
        log?: FollowupReminderSendLogRow;
      };

      if (!res.ok) {
        setBanner({ kind: "err", text: json?.error ?? `Send failed (${res.status}).` });
        return;
      }

      if (json.log) {
        setLog((prev) => [json.log!, ...prev]);
      }

      if (json.delivered === false) {
        setBanner({
          kind: "err",
          text: json.error ?? "Delivery failed. The attempt was logged as failed.",
        });
        return;
      }

      setBanner({
        kind: "ok",
        text: "Reminder sent (logged). HairAudit does not schedule follow-ups — this was a one-time manual send.",
      });
    } catch (e) {
      setBanner({ kind: "err", text: (e as Error)?.message ?? "Network error." });
    } finally {
      setSending(false);
      flight.exit();
    }
  };

  const channelsLabel = FOLLOWUP_REMINDER_DELIVERABLE_CHANNELS.join(" / ");

  return (
    <section
      className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-5"
      aria-label="Manual follow-up reminder send"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Manual follow-up send</h2>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        Operational tool for clinic staff only. Review and edit the{" "}
        <span className="text-slate-400">same</span> patient-facing draft text from above, add the recipient, then send
        once. Supported channels: <span className="text-slate-400">{channelsLabel}</span> (SMS is not wired in this product
        yet). Nothing is scheduled or sent automatically. Separate from scoring, evidence, or submission rules.
      </p>

      {banner ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            banner.kind === "ok"
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-100/90"
              : "border-rose-800/50 bg-rose-950/25 text-rose-100/90"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {!drafts.length ? (
        <p className="mt-4 text-sm text-slate-500">
          No reminder drafts are available for this case right now (all milestones may already be documented). Sent
          history below still applies if anything was logged previously.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">Draft</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                value={selectedKey}
                onChange={(e) => onDraftChange(e.target.value)}
              >
                {drafts.map((d) => (
                  <option key={d.milestoneId} value={d.milestoneId}>
                    {d.milestoneLabel} · {d.urgency.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Recipient email
              </label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="patient@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Subject (optional)
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Defaults to a calm HairAudit subject if empty"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Message (patient-facing)
            </label>
            <textarea
              className="mt-1 min-h-[180px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={sending || !selectedDraft || !recipient.trim() || !body.trim()}
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-45 disabled:pointer-events-none hover:bg-slate-800"
            >
              {sending ? "Sending…" : "Send email now"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Send log (this case)</h3>
        {log.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">No sends logged yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {log.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-slate-800/90 bg-slate-900/40 px-3 py-2 text-xs text-slate-400"
              >
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="font-medium text-slate-200">{formatWhen(row.sent_at)}</span>
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                    {row.channel}
                  </span>
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {row.milestone}
                  </span>
                  <span
                    className={
                      row.delivery_status === "sent"
                        ? "text-emerald-400/90"
                        : row.delivery_status === "failed"
                          ? "text-rose-300/90"
                          : "text-slate-400"
                    }
                  >
                    {row.delivery_status}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">
                  To: <span className="text-slate-400">{row.recipient}</span>
                  {row.subject ? (
                    <>
                      {" "}
                      · <span className="text-slate-400">{row.subject}</span>
                    </>
                  ) : null}
                </div>
                {row.error_message ? (
                  <p className="mt-1 text-rose-300/80">{row.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
