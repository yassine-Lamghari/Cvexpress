export async function callGemini(prompts: { system: string; user: string }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  let responseText = '{}';
  let apiErrorDetail = '';
  let success = false;
  let statusCode = 500;

  for (const model of geminiModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${prompts.system}\n\n${prompts.user}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json'
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        success = true;
        break;
      } else {
        statusCode = res.status;
        const errBody = await res.json().catch(() => ({}));
        apiErrorDetail = errBody.error?.message || `HTTP ${res.status}`;
        if (res.status !== 429) {
          break; // Break if not rate limited
        }
      }
    } catch (e: any) {
      apiErrorDetail = e.message;
      break;
    }
  }

  if (!success) {
    throw new Error(JSON.stringify({ error: 'AI service returned an error', detail: apiErrorDetail, httpCode: statusCode }));
  }

  return responseText;
}