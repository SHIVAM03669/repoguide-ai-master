import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLLMProvider, resolveLLMProviderKind } from './llmProvider';

describe('resolveLLMProviderKind', () => {
  const saved = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL
  };

  beforeEach(() => {
    delete process.env.LLM_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('respects explicit LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'local';
    expect(resolveLLMProviderKind()).toBe('local');
  });

  it('falls back to local when no provider env is set', () => {
    expect(resolveLLMProviderKind()).toBe('local');
  });

  it('recognizes Gemma 4 as an explicit provider', () => {
    process.env.LLM_PROVIDER = 'gemma';
    expect(resolveLLMProviderKind()).toBe('gemma');
  });
});

describe('createLLMProvider', () => {
  it('requires a Google AI Studio key for Gemma 4', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => createLLMProvider('gemma')).toThrow('GEMINI_API_KEY');
  });

  it('sends a grounded JSON request to the Gemma 4 model and labels the response', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await createLLMProvider('gemma').createStructuredResponse({
      messages: [
        { role: 'system', content: 'Cite the repository evidence.' },
        { role: 'user', content: 'What does this module do?' }
      ],
      schema: { name: 'answer', schema: { type: 'object', properties: { answer: { type: 'string' } } } }
    });

    expect(response).toEqual({ provider: 'gemma:gemma-4-26b-a4b-it', content: '{"answer":"ok"}' });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemma-4-26b-a4b-it:generateContent');
    expect(url).not.toContain('test-key');
    expect(request.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    const body = JSON.parse(request.body as string);
    expect(body.contents[0].parts[0].text).toContain('Cite the repository evidence.');
    expect(body.contents[0].parts[0].text).toContain('What does this module do?');
  });

  it('ignores Gemma thinking parts and returns only the final JSON text', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [
        { thought: true, text: 'Reasoning about the answer' },
        { text: '{"answer":"final"}' }
      ] } }] }), { status: 200 })
    ));

    const response = await createLLMProvider('gemma').createStructuredResponse({
      messages: [{ role: 'user', content: 'Question' }],
      schema: { name: 'answer', schema: { type: 'object' } }
    });

    expect(response.content).toBe('{"answer":"final"}');
  });

  it('unwraps a JSON code fence from Gemma output', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [
        { text: '```json\n{"answer":"final"}\n```' }
      ] } }] }), { status: 200 })
    ));

    const response = await createLLMProvider('gemma').createStructuredResponse({
      messages: [{ role: 'user', content: 'Question' }],
      schema: { name: 'answer', schema: { type: 'object' } }
    });

    expect(JSON.parse(response.content)).toEqual({ answer: 'final' });
  });

  it('returns local fallback provider by default', async () => {
    const provider = createLLMProvider('local');
    const response = await provider.createStructuredResponse({
      messages: [{ role: 'user', content: 'hello' }],
      schema: { name: 'demo', schema: { type: 'object' } }
    });
    expect(response.provider).toBe('local-fallback');
    expect(() => JSON.parse(response.content)).not.toThrow();
  });
});
