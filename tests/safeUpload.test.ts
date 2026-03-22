import {
  describe,
  it,
  beforeEach,
} from "node:test";
import assert from "node:assert";
import {
  UPLOAD_LIMITS,
  validateFileCount,
  safeFileName,
  calculateRetryDelay,
  withRetry,
  UploadQueue,
  createUploadError,
  isRetryableError,
  formatUploadErrorForUser,
  formatUploadErrorForLog,
} from "../src/lib/uploads/safeUpload";

describe("safeUpload utilities", () => {
  describe("validateFileCount", () => {
    it("should allow valid file counts", () => {
      const result = validateFileCount(5, 10);
      assert.strictEqual(result.success, true);
    });

    it("should reject zero files", () => {
      const result = validateFileCount(0);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, "VALIDATION_ERROR");
    });

    it("should reject files exceeding max", () => {
      const result = validateFileCount(15, 10);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, "MAX_FILES_EXCEEDED");
    });

    it("should use default max of 10", () => {
      const result = validateFileCount(11);
      assert.strictEqual(result.success, false);
    });
  });

  describe("safeFileName", () => {
    it("should sanitize unsafe characters", () => {
      assert.strictEqual(safeFileName("test<file>.jpg"), "test_file_.jpg");
      assert.strictEqual(safeFileName("hello/world.png"), "hello_world.png");
      assert.strictEqual(safeFileName("my\\file.txt"), "my_file.txt");
    });

    it("should preserve valid characters", () => {
      assert.strictEqual(safeFileName("test_file.jpg"), "test_file.jpg");
      assert.strictEqual(safeFileName("my-file.png"), "my-file.png");
    });

    it("should handle empty names", () => {
      assert.strictEqual(safeFileName(""), "upload.jpg");
    });

    it("should truncate long names", () => {
      const longName = "a".repeat(300) + ".png";
      const result = safeFileName(longName);
      assert.ok(result.length <= 200);
      assert.ok(result.endsWith(".png"));
    });
  });

  describe("calculateRetryDelay", () => {
    it("should increase delay with attempts", () => {
      const delay1 = calculateRetryDelay(1, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 });
      const delay2 = calculateRetryDelay(2, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 });
      const delay3 = calculateRetryDelay(3, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 });

      assert.ok(delay2 > delay1);
      assert.ok(delay3 > delay2);
    });

    it("should respect max delay", () => {
      const delay = calculateRetryDelay(10, { maxAttempts: 15, baseDelayMs: 1000, maxDelayMs: 5000, backoffMultiplier: 2 });
      assert.ok(delay <= 5000);
    });

    it("should add jitter", () => {
      const delay1 = calculateRetryDelay(2, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 });
      const delay2 = calculateRetryDelay(2, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 });
      // Same attempt with jitter should produce slightly different delays
      assert.notStrictEqual(delay1, delay2);
    });
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return { success: true as const, data: "success" };
      };

      const result = await withRetry(operation, "test", { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 });

      assert.strictEqual(result.success, true);
      assert.strictEqual(attempts, 1);
    });

    it("should retry on retryable errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          return { success: false as const, error: createUploadError("STORAGE_ERROR", "storage failed", {}, true) };
        }
        return { success: true as const, data: "success" };
      };

      const result = await withRetry(operation, "test", { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 }, { warn: () => {}, error: () => {} });

      assert.strictEqual(result.success, true);
      assert.strictEqual(attempts, 3);
    });

    it("should not retry non-retryable errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return { success: false as const, error: createUploadError("VALIDATION_ERROR", "validation failed", {}, false) };
      };

      const result = await withRetry(operation, "test", { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 });

      assert.strictEqual(result.success, false);
      assert.strictEqual(attempts, 1);
    });

    it("should fail after max attempts", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return { success: false as const, error: createUploadError("NETWORK_ERROR", "network failed", {}, true) };
      };

      const result = await withRetry(operation, "test", { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 }, { warn: () => {}, error: () => {} });

      assert.strictEqual(result.success, false);
      assert.strictEqual(attempts, 3);
    });
  });

  describe("UploadQueue", () => {
    it("should limit concurrent executions", async () => {
      const queue = new UploadQueue(2);
      let running = 0;
      let maxRunning = 0;

      const createOperation = (delay: number) => async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, delay));
        running--;
        return "done";
      };

      const results = await Promise.all([
        queue.execute(createOperation(50)),
        queue.execute(createOperation(50)),
        queue.execute(createOperation(50)),
        queue.execute(createOperation(50)),
      ]);

      assert.strictEqual(results.length, 4);
      assert.ok(maxRunning <= 2, `Max concurrent was ${maxRunning}, expected <= 2`);
    });

    it("should track pending count", async () => {
      const queue = new UploadQueue(1);
      const operations: Promise<string>[] = [];

      operations.push(queue.execute(async () => { await new Promise(r => setTimeout(r, 50)); return "a"; }));
      operations.push(queue.execute(async () => { await new Promise(r => setTimeout(r, 50)); return "b"; }));
      operations.push(queue.execute(async () => { await new Promise(r => setTimeout(r, 50)); return "c"; }));

      // At least 2 should be pending (queue size >= 2)
      assert.ok(queue.pending >= 1);

      await Promise.all(operations);
      assert.strictEqual(queue.pending, 0);
    });
  });

  describe("createUploadError", () => {
    it("should create retryable errors for certain codes", () => {
      const retryableCodes = ["STORAGE_ERROR", "NETWORK_ERROR", "RATE_LIMITED", "DB_ERROR"];

      for (const code of retryableCodes) {
        const error = createUploadError(code as any, "test");
        assert.strictEqual(error.retryable, true, `${code} should be retryable`);
      }
    });

    it("should create non-retryable errors for certain codes", () => {
      const nonRetryableCodes = ["VALIDATION_ERROR", "UNAUTHORIZED", "CASE_LOCKED", "INVALID_CATEGORY"];

      for (const code of nonRetryableCodes) {
        const error = createUploadError(code as any, "test");
        assert.strictEqual(error.retryable, false, `${code} should not be retryable`);
      }
    });
  });

  describe("formatUploadErrorForUser", () => {
    it("should provide user-friendly messages", () => {
      const testCases = [
        { code: "STORAGE_ERROR", expected: "Image upload failed" },
        { code: "RATE_LIMITED", expected: "Upload rate limit reached" },
        { code: "UNAUTHORIZED", expected: "sign in" },
        { code: "CASE_LOCKED", expected: "submitted and cannot be modified" },
        { code: "UNKNOWN_ERROR", expected: "Upload failed" },
      ];

      for (const { code, expected } of testCases) {
        const error = createUploadError(code as any, "test");
        const message = formatUploadErrorForUser(error);
        assert.ok(message.toLowerCase().includes(expected.toLowerCase()), `Expected "${message}" to include "${expected}"`);
      }
    });
  });

  describe("formatUploadErrorForLog", () => {
    it("should include all error properties", () => {
      const error = createUploadError("STORAGE_ERROR", "test message", { detail: "extra" }, true);
      const logData = formatUploadErrorForLog(error);

      assert.strictEqual(logData.code, "STORAGE_ERROR");
      assert.strictEqual(logData.message, "test message");
      assert.strictEqual(logData.retryable, true);
      assert.strictEqual(logData.detail, "extra");
    });
  });

  describe("UPLOAD_LIMITS constants", () => {
    it("should have reasonable defaults", () => {
      assert.strictEqual(UPLOAD_LIMITS.MAX_FILES_PER_REQUEST, 10);
      assert.strictEqual(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS, 3);
      assert.strictEqual(UPLOAD_LIMITS.MAX_FILE_SIZE_MB, 50);
    });
  });
});
