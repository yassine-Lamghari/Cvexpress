import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MAX_REQUESTS = 50;
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

function readTexTemplate(templateId: string): string {
  const allowed = ['professional', 'charles', 'rezume'];
  const safe = allowed.includes(templateId) ? templateId : 'professional';
  const filePath = join(process.cwd(), 'api', 'templates', `${safe}.tex`);
  return readFileSync(filePath, 'utf-8');
}

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const rate = getRateLimit(ip);

  if (rate.count >= MAX_REQUESTS) {
    const resetIn = Math.max(0, Math.ceil((rate.reset - Date.now()) / 60000));
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.', resetIn },
      { status: 429 }
    );
  }
  rate.count++;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { resume, skills, jobOffer, locale, candidateName, personalInfo, experiences, stages, education, languages, certifications, template } = body;
  if (!resume || !skills || !jobOffer) {
    return NextResponse.json({ error: 'Missing required fields: resume, skills, jobOffer' }, { status: 400 });
  }

  const selectedTemplate = typeof template === 'string' ? template : 'professional';
  const fullName = typeof candidateName === 'string' && candidateName.trim() ? candidateName.trim() : 'Le candidat';
  const lang = locale === 'fr' ? 'français' : 'English';

  // Read the FULL .tex template
  const texTemplate = readTexTemplate(selectedTemplate);

  // Build structured user data
  const pi = personalInfo || {};
  const personalBlock = `- Nom complet: ${fullName}
- Titre: ${pi.title || ''}
- Email: ${pi.email || ''}
- Téléphone: ${pi.phone || ''}
- Ville: ${pi.city || ''}
- Pays: ${pi.country || ''}
- LinkedIn: ${pi.linkedin || ''}
- Site web / Portfolio: ${pi.website || ''}`;

  const experiencesBlock = Array.isArray(experiences) && experiences.length
    ? experiences.map((e: { jobTitle: string; company: string; location?: string; startDate: string; endDate: string; description: string }) =>
        `  - Poste: ${e.jobTitle}\n    Entreprise: ${e.company}${e.location ? ', ' + e.location : ''}\n    Période: ${e.startDate} -- ${e.endDate}\n    Description: ${e.description}`
      ).join('\n')
    : 'Aucune';

  const stagesBlock = Array.isArray(stages) && stages.length
    ? stages.map((e: { jobTitle: string; company: string; location?: string; startDate: string; endDate: string; description: string }) =>
        `  - Poste: ${e.jobTitle}\n    Entreprise: ${e.company}${e.location ? ', ' + e.location : ''}\n    Période: ${e.startDate} -- ${e.endDate}\n    Description: ${e.description}`
      ).join('\n')
    : 'Aucun';

  const educationBlock = Array.isArray(education) && education.length
    ? education.map((e: { degree: string; school: string; location?: string; startDate: string; endDate: string; description?: string }) =>
        `  - Diplôme: ${e.degree}\n    École: ${e.school}${e.location ? ', ' + e.location : ''}\n    Période: ${e.startDate} -- ${e.endDate}${e.description ? '\n    Description: ' + e.description : ''}`
      ).join('\n')
    : 'Aucune';

  const languagesBlock = Array.isArray(languages) && languages.length
    ? languages.map((l: { name: string; level: string }) => `${l.name} (${l.level})`).join(', ')
    : 'Non spécifié';

  const certificationsBlock = Array.isArray(certifications) && certifications.length
    ? certifications.map((c: { name: string; issuer: string; date?: string }) => `${c.name} - ${c.issuer}${c.date ? ' (' + c.date + ')' : ''}`).join(', ')
    : 'Aucune';

  const systemPrompt = `Tu es un expert LaTeX spécialisé dans la rédaction de CV. Tu reçois un template LaTeX COMPLET et les informations d'un candidat.

TON TRAVAIL: Prendre le template LaTeX tel quel et REMPLACER UNIQUEMENT les données placeholder par les vraies informations du candidat.

RÈGLES ABSOLUES:
1. GARDE LE TEMPLATE IDENTIQUE: même \\documentclass, même \\usepackage, mêmes \\newcommand, mêmes couleurs, mêmes marges, même structure exacte
2. REMPLACE SEULEMENT les placeholders (noms, dates, descriptions, liens) par les données réelles du candidat
3. Si une section du template n'a pas de données correspondantes chez le candidat, SUPPRIME cette section entière (du commentaire %--- au prochain commentaire %--- ou \\section)
4. Si le candidat a des stages, ajoute une section STAGES en utilisant le MÊME format que la section Work Experience du template
5. ÉCHAPPE les caractères spéciaux LaTeX: & → \\& , % → \\% , # → \\# , _ → \\_ , $ → \\$
6. Le document doit compiler avec pdflatex SANS ERREUR
7. Améliore les descriptions avec des verbes d'action professionnels
8. Retourne le JSON avec 3 clés: latexCode, motivationLetter, candidacyEmail
9. Réponds en ${lang}`;

  const userPrompt = `## TEMPLATE LATEX (à garder IDENTIQUE, ne remplacer que les données):

${texTemplate}

## INFORMATIONS DU CANDIDAT:

### Informations personnelles:
${personalBlock}

### CV brut / Résumé:
${resume}

### Compétences:
${skills}

### Expériences professionnelles:
${experiencesBlock}

### Stages:
${stagesBlock}

### Formation:
${educationBlock}

### Langues:
${languagesBlock}

### Certifications:
${certificationsBlock}

### Offre d'emploi cible:
${jobOffer}

## INSTRUCTIONS PRÉCISES:

1. Prends le template LaTeX ci-dessus MOT POUR MOT
2. Remplace les noms placeholder (Full Name, Charles Rambo, Jane Doe) par "${fullName}"
3. Remplace les emails, téléphones, liens par ceux du candidat
4. Remplace les expériences placeholder par les VRAIES expériences du candidat
5. Remplace les formations placeholder par les VRAIES formations
6. Remplace les compétences placeholder par les VRAIES compétences
7. Si le candidat a des langues, ajoute-les dans la section Skills/Technical Skills
8. SUPPRIME les sections sans données (Projects, Publications, Extracurricular, etc. si le candidat n'en a pas)
9. Ajoute une section STAGES si le candidat en a, en copiant le format de Work Experience
10. Le résultat doit être un document LaTeX COMPLET de \\documentclass à \\end{document}

## FORMAT JSON EXACT À RETOURNER:
{
  "latexCode": "le template LaTeX COMPLET rempli avec les données du candidat",
  "motivationLetter": "lettre de motivation 3-4 paragraphes, signée ${fullName}",
  "candidacyEmail": "Objet: Candidature...\\nemail court signé ${fullName}"
}

IMPORTANT: Signe TOUJOURS avec "${fullName}", JAMAIS avec [Votre nom] ou un placeholder.`;

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
          { role: 'user', content: userPrompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 32768,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '');
      console.error('[generate] Groq error:', groqRes.status, errBody);
      return NextResponse.json(
        { error: `AI service error (${groqRes.status}): ${errBody.substring(0, 300)}` },
        { status: 502 }
      );
    }

    const groqData = await groqRes.json();
    const finishReason = groqData.choices?.[0]?.finish_reason;
    const content = groqData.choices?.[0]?.message?.content ?? '{}';
    console.log('[generate] finish_reason:', finishReason, 'length:', content.length);

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(content);
    } catch {
      const fixed = content.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      parsed = JSON.parse(fixed);
    }

    let latexCode = parsed.latexCode ?? '';

    // Post-process: convert literal \n (2 chars) to real newlines if needed
    if (latexCode && !latexCode.includes('\n') && latexCode.includes('\\n')) {
      latexCode = latexCode.replace(/\\n(?![a-z]{2,})/g, '\n');
    }

    // Ensure document starts with \documentclass
    if (latexCode) {
      const trimmed = latexCode.trimStart();
      if (trimmed.startsWith('documentclass')) {
        latexCode = '\\' + trimmed;
      }
    }

    // Ensure document ends with \end{document}
    if (latexCode && !latexCode.trimEnd().endsWith('\\end{document}')) {
      latexCode = latexCode.trimEnd() + '\n\\end{document}';
    }

    console.log('[generate] latexCode length:', latexCode.length);
    console.log('[generate] latexCode first 200:', latexCode.substring(0, 200));

    return NextResponse.json({
      success: true,
      data: {
        latexCode,
        motivationLetter: parsed.motivationLetter ?? '',
        candidacyEmail: parsed.candidacyEmail ?? '',
      },
      remaining: MAX_REQUESTS - rate.count,
    });
  } catch (err) {
    console.error('[generate] Exception:', err);
    return NextResponse.json({ error: 'Failed to connect to AI service' }, { status: 500 });
  }
}
