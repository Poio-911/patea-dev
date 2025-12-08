/**
 * Retry utilities for network requests and async operations
 * Improves app resilience with exponential backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: any) => boolean;
  /** Callback when retry occurs */
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Retry an async function with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function or throws last error
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (!opts.isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );

      // Call retry callback
      opts.onRetry(attempt, error);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Helper function to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error (retryable)
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  // Check for common network error patterns
  const networkErrorMessages = [
    'network',
    'timeout',
    'connection',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'fetch failed',
    'Failed to fetch',
  ];

  const errorMessage = String(error.message || error).toLowerCase();
  return networkErrorMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Check if error is a server error (5xx) - retryable
 */
export function isServerError(error: any): boolean {
  if (!error) return false;

  // Check status code
  const status = error.status || error.statusCode || error.code;
  if (typeof status === 'number') {
    return status >= 500 && status < 600;
  }

  return false;
}

/**
 * Check if error is a rate limit error (429) - retryable after delay
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode || error.code;
  return status === 429;
}

/**
 * Combined retryable error check
 */
export function isRetryableError(error: any): boolean {
  return isNetworkError(error) || isServerError(error) || isRateLimitError(error);
}

/**
 * Retry specifically for Firestore operations
 */
export async function retryFirestore<T>(
  fn: () => Promise<T>,
  operationName: string = 'Firestore operation'
): Promise<T> {
  return retryAsync(fn, {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 5000,
    isRetryable: (error) => {
      // Retry on Firestore-specific errors
      const errorCode = error?.code;
      const retryableCodes = [
        'unavailable',
        'deadline-exceeded',
        'resource-exhausted',
        'aborted',
        'internal',
      ];
      return retryableCodes.includes(errorCode) || isNetworkError(error);
    },
    onRetry: (attempt, error) => {
      console.warn(`[Retry] ${operationName} failed, attempt ${attempt}/3:`, error.message);
    },
  });
}

/**
 * Retry specifically for AI/API calls
 */
export async function retryAI<T>(
  fn: () => Promise<T>,
  operationName: string = 'AI operation'
): Promise<T> {
  return retryAsync(fn, {
    maxAttempts: 2, // AI calls are expensive, only retry once
    initialDelay: 2000,
    maxDelay: 5000,
    isRetryable: (error) => {
      // Don't retry on auth errors or bad requests
      const status = error?.status || error?.statusCode;
      if (status === 401 || status === 403 || status === 400) {
        return false;
      }
      return isRetryableError(error);
    },
    onRetry: (attempt, error) => {
      console.warn(`[Retry AI] ${operationName} failed, retrying...`, error.message);
    },
  });
}

/**
 * Retry with timeout - fails if operation takes too long
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  return retryAsync(async () => {
    return Promise.race([
      fn(),
      sleep(timeoutMs).then(() => {
        throw new Error(`Operation timed out after ${timeoutMs}ms`);
      }),
    ]);
  }, options);
}

/**
 * Circuit breaker pattern - stops retrying after too many failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
    }

    try {
      const result = await fn();

      // Success - reset circuit breaker
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.threshold) {
        this.state = 'open';
        console.error(`[Circuit Breaker] OPEN after ${this.failureCount} failures`);
      }

      throw error;
    }
  }

  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
