/**
 * Safe upload utilities with retry logic, concurrency control, and structured error handling.
 * Used across patient, doctor, and clinic upload flows.
 */

export type UploadErrorCode =
  | "STORAGE_ERROR"
  | "DB_ERROR"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "CASE_LOCKED"
  | "FILE_TOO_LARGE"
  | "INVALID_CATEGORY"
  | "MAX_FILES_EXCEEDED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type UploadError = {
  code: UploadErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
};

export type UploadResult<T> =
  | { success: true; data: T }
  | { success: false; error: UploadError };

export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export const UPLOAD_LIMITS = {
  MAX_FILES_PER_REQUEST: 10,
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_FILE_SIZE_MB: 50,
};

/**
 * Check if an error is retryable (transient failure).
 */
export function isRetryableError(error: UploadError): boolean {
  if (!error.retryable) return false;
  
  const retryableCodes: UploadErrorCode[] = [
    "STORAGE_ERROR",
    "NETWORK_ERROR",
    "RATE_LIMITED",
    "DB_ERROR",
  ];
  
  return retryableCodes.includes(error.code);
}

/**
 * Create a standardized upload error.
 */
export function createUploadError(
  code: UploadErrorCode,
  message: string,
  details?: Record<string, unknown>
): UploadError {
  const retryable = [
    "STORAGE_ERROR",
    "NETWORK_ERROR",
    "RATE_LIMITED",
    "DB_ERROR",
  ].includes(code);
  
  return { code, message, details, retryable };
}

/**
 * Sleep utility for retry delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);
  return Math.round(delay);
}

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<UploadResult<T>>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: { warn?: (msg: string, meta?: Record<string, unknown>) => void; error?: (msg: string, meta?: Record<string, unknown>) => void }
): Promise<UploadResult<T>> {
  let lastError: UploadError | null = null;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const result = await operation();
    
    if (result.success) {
      if (attempt > 1) {
        logger?.warn?.(`${operationName} succeeded on attempt ${attempt}`, { attempts: attempt });
      }
      return result;
    }
    
    lastError = result.error;
    
    // Don't retry non-retryable errors
    if (!isRetryableError(result.error)) {
      logger?.error?.(`${operationName} failed with non-retryable error`, {
        code: result.error.code,
        attempt,
      });
      return result;
    }
    
    // Don't sleep after the last attempt
    if (attempt < config.maxAttempts) {
      const delay = calculateRetryDelay(attempt, config);
      logger?.warn?.(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, {
        code: result.error.code,
        attempt,
        nextAttempt: attempt + 1,
      });
      await sleep(delay);
    }
  }
  
  // All attempts exhausted
  logger?.error?.(`${operationName} failed after ${config.maxAttempts} attempts`, {
    code: lastError?.code,
    message: lastError?.message,
  });
  
  return {
    success: false,
    error: lastError ?? createUploadError("UNKNOWN_ERROR", "All retry attempts failed"),
  };
}

/**
 * Concurrency-limited queue for upload operations.
 */
export class UploadQueue {
  private running = 0;
  private queue: Array<() => void> = [];
  
  constructor(private maxConcurrent: number = UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Wait if at capacity
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    
    this.running++;
    
    try {
      return await operation();
    } finally {
      this.running--;
      // Start next queued operation
      const next = this.queue.shift();
      next?.();
    }
  }
  
  get pending(): number {
    return this.queue.length;
  }
  
  get active(): number {
    return this.running;
  }
}

/**
 * Validate file count before upload.
 */
export function validateFileCount(
  count: number,
  maxFiles: number = UPLOAD_LIMITS.MAX_FILES_PER_REQUEST
): UploadResult<void> {
  if (count === 0) {
    return {
      success: false,
      error: createUploadError("VALIDATION_ERROR", "No files provided"),
    };
  }
  
  if (count > maxFiles) {
    return {
      success: false,
      error: createUploadError(
        "MAX_FILES_EXCEEDED",
        `Maximum ${maxFiles} files per upload. Please upload in batches.`,
        { provided: count, max: maxFiles }
      ),
    };
  }
  
  return { success: true, data: undefined };
}

/**
 * Safe file name sanitizer.
 */
export function safeFileName(name: string): string {
  // Remove path traversal attempts and unsafe characters
  const baseName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Limit length
  if (baseName.length > 200) {
    const ext = baseName.split(".").pop() ?? "jpg";
    return `${baseName.slice(0, 195)}.${ext}`;
  }
  return baseName || "upload.jpg";
}

/**
 * Format upload errors for user display.
 */
export function formatUploadErrorForUser(error: UploadError): string {
  const userMessages: Record<UploadErrorCode, string> = {
    STORAGE_ERROR: "Image upload failed. Please try again.",
    DB_ERROR: "Could not save upload record. Please try again.",
    VALIDATION_ERROR: error.message,
    RATE_LIMITED: "Upload rate limit reached. Please wait a moment and try again.",
    UNAUTHORIZED: "Please sign in to upload images.",
    CASE_LOCKED: "This case has been submitted and cannot be modified.",
    FILE_TOO_LARGE: "File is too large. Maximum size is 50MB per image.",
    INVALID_CATEGORY: "Invalid upload category. Please refresh the page.",
    MAX_FILES_EXCEEDED: error.message,
    NETWORK_ERROR: "Network connection failed. Please check your connection and try again.",
    UNKNOWN_ERROR: "Upload failed. Please try again.",
  };
  
  return userMessages[error.code] ?? error.message;
}

/**
 * Format upload errors for debugging/logging.
 */
export function formatUploadErrorForLog(error: UploadError): Record<string, unknown> {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...error.details,
  };
}
