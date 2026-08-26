const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_NVIDIA_MODEL = 'deepseek-ai/deepseek-v4-flash-0731';
const DEFAULT_NVIDIA_FALLBACK_MODEL = 'minimaxai/minimax-m3';

type NvidiaPrompt = {
  system: string;
  user: string;
};

type NvidiaCompletionOptions = {
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  temperature?: number;
  thinking?: boolean;
  timeoutMs?: number;
  topP?: number;
};

type NvidiaChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
  detail?: string;
};

function serviceError(detail: string, httpCode: number): Error {
  return new Error(JSON.stringify({
    error: 'AI service returned an error',
    detail,
    httpCode,
  }));
}

export async function callNvidia(
  prompts: NvidiaPrompt,
  options: NvidiaCompletionOptions = {},
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw serviceError('NVIDIA_API_KEY is not configured', 500);
  }

  const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, '');
  const model = process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
  const fallbackModel = process.env.NVIDIA_FALLBACK_MODEL || DEFAULT_NVIDIA_FALLBACK_MODEL;

  const requestCompletion = (selectedModel: string, includeThinking: boolean) => fetch(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: prompts.system },
          { role: 'user', content: prompts.user },
        ],
        temperature: includeThinking ? (options.temperature ?? 1) : 0.2,
        top_p: options.topP ?? 0.95,
        max_tokens: includeThinking ? (options.maxTokens ?? 16_384) : Math.min(options.maxTokens ?? 8_192, 8_192),
        ...(includeThinking ? {
          chat_template_kwargs: {
            thinking: options.thinking ?? true,
            reasoning_effort: options.reasoningEffort ?? 'high',
          },
        } : {}),
        stream: false,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 115_000),
      cache: 'no-store',
    },
  );

  let response: Response;
  try {
    response = await requestCompletion(model, true);
    if (response.status === 404 && fallbackModel && fallbackModel !== model) {
      response = await requestCompletion(fallbackModel, false);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to reach NVIDIA API';
    throw serviceError(detail, 502);
  }

  const data = await response.json().catch(() => ({})) as NvidiaChatCompletion;
  if (!response.ok) {
    throw serviceError(
      data.error?.message || data.detail || `NVIDIA API returned HTTP ${response.status}`,
      response.status,
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw serviceError('NVIDIA API returned an empty completion', 502);
  }

  return content;
}
