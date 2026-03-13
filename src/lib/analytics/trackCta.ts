export function trackCta(eventName: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const payload = {
    event: eventName,
    ...meta,
  };

  const w = window as typeof window & { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push(payload);
  }

  window.dispatchEvent(new CustomEvent("hairaudit:cta", { detail: payload }));
}
