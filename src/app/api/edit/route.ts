import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MAX_REQUESTS = 100;
const WINDOW_MS = 3600_000;

const rateMap = new Map<string, { count: number; reset: number }>();

function getRateLimit(ip: string) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + WINDOW_MS };
    rateMap.set(ip, entry);
  }
  return entry;
}

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const rate = getRateLimit(ip);

  if (rate.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }
  rate.count++;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { latexCode, instruction, locale } = body;
  if (!latexCode || !instruction) {
    return NextResponse.json({ error: 'Missing required fields: latexCode, instruction' }, { status: 400 });
  }

  if (typeof latexCode !== 'string' || typeof instruction !== 'string') {
    return NextResponse.json({ error: 'Invalid field types' }, { status: 400 });
  }

  if (instruction.length > 1000) {
    return NextResponse.json({ error: 'Instruction too long (max 1000 characters)' }, { status: 400 });
  }

  const lang = locale === 'fr' ? 'français' : 'English';

  const systemPrompt = `Tu es un éditeur LaTeX expert pour CV. Tu reçois un document LaTeX complet et une instruction de modification de l'utilisateur. Tu dois appliquer la modification demandée et retourner le document LaTeX COMPLET modifié.

RÈGLES:
- Retourne UNIQUEMENT le code LaTeX modifié, du \\documentclass jusqu'au \\end{document}.
- NE retourne PAS de JSON, pas de markdown, pas de backticks, pas d'explications.
- GARDE INTACTE la structure LaTeX (préambule, packages, commandes).
- Applique UNIQUEMENT la modification demandée, ne change rien d'autre.
- Le résultat doit être COMPILABLE avec pdflatex sans erreur.
- Réponds en ${lang} pour le contenu textuel.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `## DOCUMENT LATEX ACTUEL:\n${latexCode}\n\n## INSTRUCTION DE MODIFICATION:\n${instruction}` },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 32768,
      }),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '');
      console.error('[edit] Groq error:', groqRes.status, errBody);
      return NextResponse.json(
        { error: `AI service error (${groqRes.status})` },
        { status: 502 }
      );
    }

    const groqData = await groqRes.json();
    let newLatexCode = groqData.choices?.[0]?.message?.content ?? '';

    // Strip markdown code fences if LLM wrapped the response
    newLatexCode = newLatexCode.replace(/^```(?:latex|tex)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Ensure document starts with \documentclass
    if (newLatexCode) {
      const trimmed = newLatexCode.trimStart();
      if (trimmed.startsWith('documentclass')) {
        newLatexCode = '\\' + trimmed;
      }
    }

    if (!newLatexCode || !newLatexCode.includes('\\documentclass')) {
      return NextResponse.json({ error: 'AI returned invalid LaTeX' }, { status: 500 });
    }

    // Ensure document ends with \end{document}
    if (!newLatexCode.trimEnd().endsWith('\\end{document}')) {
      newLatexCode = newLatexCode.trimEnd() + '\n\\end{document}';
    }

    return NextResponse.json({
      success: true,
      data: { latexCode: newLatexCode },
      remaining: MAX_REQUESTS - rate.count,
    });
  } catch (err) {
    console.error('[edit] Exception:', err);
    return NextResponse.json({ error: 'Failed to connect to AI service' }, { status: 500 });
  }
}
