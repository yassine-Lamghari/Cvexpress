import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const input = await req.json();

    const latexCode = input.latexCode || '';
    const instruction = input.instruction || '';
    const locale = input.locale || 'fr';

    if (!latexCode || !instruction) {
      return NextResponse.json({ error: 'Missing required fields: latexCode, instruction' }, { status: 400 });
    }

    if (typeof latexCode !== 'string' || typeof instruction !== 'string') {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 });
    }

    if (instruction.length > 1000) {
      return NextResponse.json({ error: 'Instruction too long (max 1000 characters)' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    let systemPrompt = '';
    if (locale === 'fr') {
        systemPrompt = `Tu es un éditeur LaTeX expert pour CV professionnels. Tu reçois un document LaTeX complet et une instruction de modification de l'utilisateur. Tu dois appliquer la modification demandée et retourner le document LaTeX COMPLET modifié.

RÈGLES:
- Retourne UNIQUEMENT le code LaTeX modifié, du \\documentclass jusqu'au \\end{document}.
- NE retourne PAS de JSON, pas de markdown, pas de backticks, pas d'explications.
- PRÉSERVE INTÉGRALEMENT le préambule LaTeX: \\documentclass, tous les \\usepackage, et toutes les commandes custom (\\CVSubheading, \\CVItem, \\resumeSubheading, \\resumeItem, \\resumeQuadHeading, \\resumeTrioHeading, \\resumeSectionType, etc.).
- PRÉSERVE la mise en page: marges, espacement, police, taille de police. Ne change que le CONTENU demandé.
- Applique UNIQUEMENT la modification demandée, ne change rien d'autre.
- NE SUPPRIME PAS de sections ou commandes qui ne sont pas mentionnées dans l'instruction.
- Les accents français sont supportés nativement par babel — ne les échappe pas.
- Quand tu réécris du contenu de CV, utilise des verbes d'action forts et des métriques chiffrées quand possible.
- AUCUN champ ne doit rester vide après modification.
- Le résultat doit être COMPILABLE avec pdflatex sans erreur.
- Réponds en français pour le contenu textuel.`;
    } else {
        systemPrompt = `You are an expert LaTeX CV editor for professional resumes. You receive a complete LaTeX document and a modification instruction from the user. You must apply the requested modification and return the COMPLETE modified LaTeX document.

RULES:
- Return ONLY the modified LaTeX code, from \\documentclass to \\end{document}.
- Do NOT return JSON, markdown, backticks, or explanations.
- PRESERVE the entire LaTeX preamble: \\documentclass, all \\usepackage, and all custom commands.
- PRESERVE the layout: margins, spacing, fonts, font sizes. Change ONLY the requested CONTENT.
- Apply ONLY the requested modification, do not change anything else.
- Do NOT remove sections or commands not mentioned in the instruction.
- When rewriting CV content, use strong action verbs and quantified metrics where possible.
- NO field should be left empty after modifications.
- The result MUST be compilable with pdflatex without errors.
- Respond in English for text content.`;
    }

    const userPrompt = `## DOCUMENT LATEX ACTUEL:\n${latexCode}\n\n## INSTRUCTION DE MODIFICATION:\n${instruction}`;

    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let responseText = '';
    let apiErrorDetail = '';
    let success = false;
    let statusCode = 500;

    for (const model of geminiModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
        }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          success = true;
          break;
        } else {
          statusCode = res.status;
          const errBody = await res.json().catch(() => ({}));
          apiErrorDetail = errBody.error?.message || `HTTP ${res.status}`;
          if (res.status !== 429) {
            break;
          }
        }
      } catch (e: any) {
        apiErrorDetail = e.message;
        break;
      }
    }

    if (!success) {
      return NextResponse.json({ error: 'AI service returned an error', detail: apiErrorDetail }, { status: statusCode !== 500 ? statusCode : 502 });
    }

    // Clean up markdown markers if AI still added them
    let cleanCode = responseText.trim();
    if (cleanCode.startsWith('```latex')) {
      cleanCode = cleanCode.substring(8);
    } else if (cleanCode.startsWith('```')) {
      cleanCode = cleanCode.substring(3);
    }
    if (cleanCode.endsWith('```')) {
      cleanCode = cleanCode.substring(0, cleanCode.length - 3);
    }
    cleanCode = cleanCode.trim();

    return NextResponse.json({ success: true, latexCode: cleanCode, remaining: 100 });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
  }
}
