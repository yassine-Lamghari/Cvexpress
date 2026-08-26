import { afterEach, describe, expect, it, vi } from 'vitest';
import { callNvidia } from './aiService';

describe('callNvidia', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('calls the configured NVIDIA chat completion model', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'generated content' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await callNvidia({ system: 'system prompt', user: 'user prompt' });

    expect(result).toBe('generated content');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer test-key' });

    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({
      model: 'deepseek-ai/deepseek-v4-flash-0731',
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16_384,
      stream: false,
      chat_template_kwargs: {
        thinking: true,
        reasoning_effort: 'high',
      },
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
    });
  });

  it('fails before making a request when the API key is missing', async () => {
    vi.stubEnv('NVIDIA_API_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(callNvidia({ system: 'system', user: 'user' }))
      .rejects.toThrow('NVIDIA_API_KEY is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports a faster completion profile for large application prompts', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'fast content' } }],
    }), { status: 200 }));

    await callNvidia(
      { system: 'system', user: 'user' },
      {
        maxTokens: 4_096,
        reasoningEffort: 'medium',
        temperature: 0.7,
        thinking: false,
        timeoutMs: 295_000,
      },
    );

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      max_tokens: 4_096,
      temperature: 0.7,
      chat_template_kwargs: { thinking: false, reasoning_effort: 'medium' },
    });
  });

  it('uses the NVIDIA fallback when the requested model is unavailable', async () => {
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Function not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'fallback content' } }],
      }), { status: 200 }));

    const result = await callNvidia({ system: 'system', user: 'user' });

    expect(result).toBe('fallback content');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(fallbackPayload.model).toBe('minimaxai/minimax-m3');
    expect(fallbackPayload).not.toHaveProperty('chat_template_kwargs');
  });
});
