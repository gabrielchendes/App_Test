import { GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export interface GeminiRetryOptions {
  ai: GoogleGenAI;
  candidateModels?: string[];
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentParameters['config'];
  maxAttemptsPerModel?: number;
  baseDelayMs?: number;
  perCallTimeoutMs?: number;
  totalBudgetMs?: number;
  logPrefix?: string;
}

export function isRetryableGeminiError(error: any): boolean {
  if (!error) return false;
  const rawStr = typeof error === 'string' ? error : (JSON.stringify(error) || String(error));
  const msg = (error.message || error.error?.message || rawStr).toLowerCase();
  const status = error.status || error.code || error.statusCode || error.error?.code || error.error?.status;

  if (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED'
  ) {
    return true;
  }

  if (
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota exceeded') ||
    msg.includes('overloaded') ||
    msg.includes('try again later') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  ) {
    return true;
  }

  return false;
}

export async function generateContentWithRetry(
  options: GeminiRetryOptions
): Promise<{ text: string; modelUsed: string; response: GenerateContentResponse }> {
  const {
    ai,
    candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
    contents,
    config,
    maxAttemptsPerModel = 1,
    baseDelayMs = 300,
    perCallTimeoutMs = 7500,
    totalBudgetMs = 9200,
    logPrefix = '[Gemini Call]'
  } = options;

  const startTime = Date.now();
  let lastError: any = null;

  for (const modelName of candidateModels) {
    // If we are approaching the serverless execution budget, break early to respond cleanly before Vercel kills the function
    const timeElapsed = Date.now() - startTime;
    if (timeElapsed >= totalBudgetMs - 1200) {
      console.info(`${logPrefix} Approaching execution time budget (${timeElapsed}ms / ${totalBudgetMs}ms). Halting further model attempts.`);
      break;
    }

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      // Check remaining time before starting another attempt
      const remainingTime = totalBudgetMs - (Date.now() - startTime);
      if (remainingTime < 1200) {
        console.info(`${logPrefix} Not enough time remaining (${remainingTime}ms) for attempt ${attempt} on ${modelName}.`);
        break;
      }

      const effectiveCallTimeout = Math.min(perCallTimeoutMs, remainingTime - 300);

      try {
        let timer: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Call to model ${modelName} reached deadline after ${effectiveCallTimeout}ms`));
          }, effectiveCallTimeout);
        });

        const callPromise = ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        const response = await Promise.race([callPromise, timeoutPromise]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        if (response && response.text) {
          return {
            text: response.text,
            modelUsed: modelName,
            response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const isRetryable = isRetryableGeminiError(err);
        const rawErrStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || String(err));

        console.info(
          `${logPrefix} Model ${modelName} note: ${rawErrStr}. Trying candidate fallback...`
        );

        const isHighDemand =
          rawErrStr.toLowerCase().includes('high demand') ||
          rawErrStr.toLowerCase().includes('spikes in demand') ||
          rawErrStr.toLowerCase().includes('unavailable') ||
          rawErrStr.toLowerCase().includes('overloaded') ||
          rawErrStr.toLowerCase().includes('timed out') ||
          rawErrStr.toLowerCase().includes('deadline') ||
          err?.status === 503 ||
          err?.code === 503 ||
          err?.error?.code === 503;

        // On high demand or timeout, immediately fail over to the next candidate model
        if (isHighDemand) {
          break;
        }

        if (!isRetryable && attempt === 1) {
          break;
        }

        const delay = Math.round(
          baseDelayMs * Math.pow(1.3, attempt - 1) + Math.random() * 150
        );

        if (attempt < maxAttemptsPerModel && (Date.now() - startTime + delay) < totalBudgetMs - 1500) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error(`${logPrefix} All candidate models failed or were busy.`);
}
