export function escapeLatexText(text: string): string {
  const map: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  };
  return text.replace(/[\\{}&%$#_^~]/g, (match) => map[match] || match);
}

export function postProcessLatex(latexOutput: string, template: string): string {
  if (!latexOutput) return latexOutput;

  // Ensure document starts with \documentclass
  let trimmed = latexOutput.trimStart();
  if (trimmed.startsWith('documentclass')) {
    latexOutput = '\\' + trimmed;
  }

  // Block dangerous commands
  const forbiddenPatterns = /\\write18\b|\\immediate\s*\\write18|\\input\s*\|/i;
  if (forbiddenPatterns.test(latexOutput)) {
    throw new Error('Generated LaTeX contains forbidden commands');
  }

  // Validate \documentclass presence
  if (!latexOutput.includes('\\documentclass')) {
    throw new Error('AI returned invalid LaTeX (missing documentclass)');
  }

  // Strip %%BEGIN_SECTION_*%% and %%END_SECTION_*%% markers but KEEP the content
  latexOutput = latexOutput.replace(/%%BEGIN_SECTION_[A-Z_]+%%\s*\n?/g, '');
  latexOutput = latexOutput.replace(/%%END_SECTION_[A-Z_]+%%\s*\n?/g, '');

  // Remove any remaining %%...%% markers
  latexOutput = latexOutput.replace(/%%[A-Z_]+%%/g, '');

  // Remove stray "%% REPEAT" and "%% END REPEAT" comments
  latexOutput = latexOutput.replace(/^\s*%%\s*(REPEAT|END REPEAT).*$/gm, '');

  // Remove leftover placeholder lines
  const placeholders = [
    'Description of achievement or responsibility', 'Description here', 'Period',
    'Start -- End', 'Start - End', 'Start Date -- End Date',
    'Institution Name', 'Company Name', 'Company Name, Location',
    'Degree Name', 'Degree and Specialization', 'Job Title',
    'Job Title}{}', 'Internship Title}{}', 'Project Title',
    'Certification Name', 'Technologies}{}', 'task 1', 'task 2', 'detail 1',
    'Skill Category', 'Skill 1, Skill 2, Skill 3', 'Language Name -- Proficiency',
  ];
  
  for (const ph of placeholders) {
    // Escape regex characters in placeholder
    const escapedPh = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^.*${escapedPh}\\s*$`, 'gm');
    latexOutput = latexOutput.replace(regex, '');
  }

  // Fix escaped underscores inside \href{} URLs
  latexOutput = latexOutput.replace(/\\href\{([^{}]+)\}/g, (_, url) => {
    return `\\href{${url.replace(/\\_/g, '_')}}`;
  });

  // Remove undefined fontawesome commands (except for one_and_half_column template)
  if (template !== 'one_and_half_column') {
    latexOutput = latexOutput.replace(/\\fa[A-Z][a-zA-Z]*(?:\{[^{}]*\})?/g, '');
    latexOutput = latexOutput.replace(/\\textcolor\{[^{}]*\}\{([^{}]*)\}/g, '$1');
  }

  // Remove forced line breaks that split sentences in content macros
  latexOutput = normalizeInlineBreaksInBody(latexOutput);

  // Clean up excessive blank lines
  latexOutput = latexOutput.replace(/\n{4,}/g, '\n\n\n');

  return latexOutput;
}

function normalizeInlineBreaksInBody(latexOutput: string): string {
  const beginDoc = latexOutput.indexOf('\\begin{document}');
  if (beginDoc === -1) return latexOutput;

  const preamble = latexOutput.slice(0, beginDoc);
  const body = latexOutput.slice(beginDoc);

  const specs: Array<{ name: string; maxArgs: number; sanitizeArgs: number[] }> = [
    { name: 'resumeItem', maxArgs: 1, sanitizeArgs: [1] },
    { name: 'CVItem', maxArgs: 1, sanitizeArgs: [1] },
    { name: 'cvitem', maxArgs: 2, sanitizeArgs: [2] },
    { name: 'resumeSectionType', maxArgs: 3, sanitizeArgs: [1, 2, 3] },
    { name: 'resumeSubheading', maxArgs: 4, sanitizeArgs: [1, 2, 3, 4] },
    { name: 'resumeQuadHeading', maxArgs: 4, sanitizeArgs: [1, 2, 3, 4] },
    { name: 'resumeTrioHeading', maxArgs: 3, sanitizeArgs: [1, 2, 3] },
    { name: 'resumeProjectHeading', maxArgs: 2, sanitizeArgs: [1, 2] },
    { name: 'CVSubheading', maxArgs: 4, sanitizeArgs: [1, 2, 3, 4] },
  ];

  let cleanedBody = body;
  for (const spec of specs) {
    cleanedBody = sanitizeMacroArgs(cleanedBody, spec.name, spec.maxArgs, spec.sanitizeArgs);
  }

  return preamble + cleanedBody;
}

function sanitizeMacroArgs(
  latex: string,
  name: string,
  maxArgs: number,
  sanitizeArgs: number[]
): string {
  const sanitizeSet = new Set(sanitizeArgs);
  let result = '';
  let i = 0;

  while (i < latex.length) {
    const ch = latex[i];
    if (ch !== '\\') {
      result += ch;
      i++;
      continue;
    }

    const nameStart = i + 1;
    if (nameStart >= latex.length || !/[A-Za-z@]/.test(latex[nameStart])) {
      result += ch;
      i++;
      continue;
    }

    let nameEnd = nameStart;
    while (nameEnd < latex.length && /[A-Za-z@]/.test(latex[nameEnd])) nameEnd++;
    const cmdName = latex.slice(nameStart, nameEnd);

    if (cmdName !== name) {
      result += latex.slice(i, nameEnd);
      i = nameEnd;
      continue;
    }

    let k = nameEnd;
    let end = k;
    const segments: string[] = [];
    let ok = true;

    for (let argIndex = 1; argIndex <= maxArgs; argIndex++) {
      const wsStart = k;
      while (k < latex.length && /\s/.test(latex[k])) k++;
      const ws = latex.slice(wsStart, k);

      if (latex[k] !== '{') {
        ok = false;
        end = k;
        break;
      }

      let depth = 1;
      const argStart = k;
      k++;
      while (k < latex.length && depth > 0) {
        const current = latex[k];
        const next = latex[k + 1];

        if (current === '\\' && (next === '{' || next === '}')) {
          k += 2;
          continue;
        }

        if (current === '{') depth++;
        else if (current === '}') depth--;
        k++;
      }

      if (depth !== 0) {
        ok = false;
        end = k;
        break;
      }

      const argContent = latex.slice(argStart + 1, k - 1);
      const cleaned = sanitizeSet.has(argIndex) ? normalizeInlineBreaks(argContent) : argContent;
      segments.push(ws + '{' + cleaned + '}');
      end = k;
    }

    if (!ok) {
      result += latex.slice(i, end);
      i = end;
      continue;
    }

    result += '\\' + cmdName + segments.join('');
    i = end;
  }

  return result;
}

function normalizeInlineBreaks(text: string): string {
  let cleaned = text.replace(/\\newline\s*/g, ' ');
  cleaned = cleaned.replace(/\\\\\*?(?:\s*\[[^\]]*\])?\s*/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned;
}

export function validateBraceBalance(latexOutput: string): string {
  let openCount = 0;
  let balanced = '';

  for (let i = 0; i < latexOutput.length; i++) {
    const char = latexOutput[i];
    const next = latexOutput[i + 1];

    // Preserve escaped braces literally instead of counting them.
    if (char === '\\' && (next === '{' || next === '}')) {
      balanced += char + next;
      i++;
      continue;
    }

    if (char === '{') {
      openCount++;
      balanced += char;
      continue;
    }

    if (char === '}') {
      if (openCount > 0) {
        openCount--;
        balanced += char;
      }
      continue;
    }

    balanced += char;
  }

  if (openCount > 0) {
    const missing = '}'.repeat(openCount);
    const endDocPos = balanced.lastIndexOf('\\end{document}');
    if (endDocPos !== -1) {
      balanced = balanced.slice(0, endDocPos) + missing + '\n' + balanced.slice(endDocPos);
    } else {
      balanced += missing;
    }
  }

  return balanced;
}

export function validateResumeSubheading(latexOutput: string): string {
  const regex = /\\resumeSubheading\s*(\{[^{}]*\})\s*(\{[^{}]*\})\s*(?:(\{[^{}]*\})\s*(\{[^{}]*\}))?/g;
  // This simplistic approach might fail on nested braces,
  // but matches the basic logic seen in PHP. A recursive brace matcher is better,
  // but replicating exactly for now without ReDoS vulnerabilities.
  return latexOutput.replace(regex, (_, a1, a2, a3, a4) => {
    const p3 = a3 && a3 !== '' ? a3 : '{}';
    const p4 = a4 && a4 !== '' ? a4 : '{}';
    return `\\resumeSubheading${a1}${a2}\n      ${p3}${p4}`;
  });
}
