"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildPatientCaseStatusPayload,
  getPatientCasePollIntervalMs,
  shouldPollPatientCaseStatus,
  type PatientCaseStatusPayload,
} from "@/lib/patient/patientProcessingView";

export type UsePatientCaseStatusPollingArgs = {
  caseId: string;
  caseStatus: string;
  hasReportPdf?: boolean;
  notificationEmail?: string | null;
  submittedAt?: string | null;
  enabled?: boolean;
  onReportReady?: (payload: PatientCaseStatusPayload) => void;
};

export type UsePatientCaseStatusPollingResult = {
  payload: PatientCaseStatusPayload;
  isPolling: boolean;
  pollError: string | null;
  refresh: () => Promise<void>;
};

function buildInitialPayload(args: UsePatientCaseStatusPollingArgs): PatientCaseStatusPayload {
  return buildPatientCaseStatusPayload({
    caseId: args.caseId,
    caseStatus: args.caseStatus,
    hasReportPdf: Boolean(args.hasReportPdf),
    submittedAt: args.submittedAt,
    notificationEmail: args.notificationEmail,
  });
}

export function usePatientCaseStatusPolling(
  args: UsePatientCaseStatusPollingArgs
): UsePatientCaseStatusPollingResult {
  const {
    caseId,
    caseStatus,
    hasReportPdf = false,
    notificationEmail,
    submittedAt,
    enabled = true,
    onReportReady,
  } = args;

  const [payload, setPayload] = useState<PatientCaseStatusPayload>(() => buildInitialPayload(args));
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const reportReadyNotifiedRef = useRef(payload.reportReady);
  const onReportReadyRef = useRef(onReportReady);

  useEffect(() => {
    onReportReadyRef.current = onReportReady;
  }, [onReportReady]);

  useEffect(() => {
    setPayload(
      buildPatientCaseStatusPayload({
        caseId,
        caseStatus,
        hasReportPdf,
        submittedAt,
        notificationEmail,
      })
    );
  }, [caseId, caseStatus, hasReportPdf, submittedAt, notificationEmail]);

  const clearScheduledPoll = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    setIsPolling(true);
    setPollError(null);

    try {
      const res = await fetch(`/api/patient/cases/${caseId}/status`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Status request failed (${res.status})`);
      }

      const next = (await res.json()) as PatientCaseStatusPayload;
      setPayload(next);

      if (next.reportReady && !reportReadyNotifiedRef.current) {
        reportReadyNotifiedRef.current = true;
        onReportReadyRef.current?.(next);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setPollError((error as Error).message ?? "Unable to refresh status");
    } finally {
      inFlightRef.current = false;
      setIsPolling(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [caseId]);

  useEffect(() => {
    reportReadyNotifiedRef.current = payload.reportReady;
  }, [payload.reportReady]);

  useEffect(() => {
    if (!shouldPollPatientCaseStatus(payload.reportReady, enabled)) {
      clearScheduledPoll();
      abortInFlight();
      return;
    }

    let cancelled = false;

    const scheduleNext = () => {
      clearScheduledPoll();
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const delayMs = getPatientCasePollIntervalMs(hidden);
      timeoutRef.current = setTimeout(async () => {
        if (cancelled) return;
        await refresh();
        if (!cancelled) scheduleNext();
      }, delayMs);
    };

    void refresh().finally(() => {
      if (!cancelled) scheduleNext();
    });

    const onVisibilityChange = () => {
      if (cancelled || !shouldPollPatientCaseStatus(payload.reportReady, enabled)) return;
      clearScheduledPoll();
      scheduleNext();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearScheduledPoll();
      abortInFlight();
    };
  }, [abortInFlight, clearScheduledPoll, enabled, payload.reportReady, refresh]);

  return { payload, isPolling, pollError, refresh };
}
