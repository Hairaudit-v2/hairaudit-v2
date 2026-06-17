/** Safe string for server-side logs — never assumes `error` is an Error instance. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return String(error);
  } catch {
    return "Unknown error";
  }
}

/** Structured context for console.error without leaking non-serializable values. */
export function safeLogErrorContext(error: unknown): { message: string } {
  return { message: getErrorMessage(error) };
}
