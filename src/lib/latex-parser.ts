export interface ParsedEntry {
  title: string;
  subtitle: string;
  date: string;
  location: string;
  bullets: string[];
}

export interface SkillGroup {
  category: string;
  values: string;
}

export interface ParsedSection {
  id: string;
  name: string;
  type: 'header' | 'text' | 'entries' | 'skills' | 'items';
  rawLatex: string;
  entries?: ParsedEntry[];
  skillGroups?: SkillGroup[];
  textContent?: string;
  items?: string[];
  headerFields?: {
    name?: string;
    phone?: string;
    email?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    location?: string;
    title?: string;
  };
  heightRatio: number;
}

/** Strip LaTeX commands to extract readable text */
export function stripLatex(s: string): string {
  return s
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\normalsize\{([^}]*)\}/g, '$1')
    .replace(/\\small\{([^}]*)\}/g, '$1')
    .replace(/\\large\s*/g, '')
    .replace(/\\Huge\s*/g, '')
    .replace(/\\huge\s*/g, '')
    .replace(/\\scshape\{([^}]*)\}/g, '$1')
    .replace(/\\scshape\s*/g, '')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\uline\{([^}]*)\}/g, '$1')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\color\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\color\{[^}]*\}/g, '')
    .replace(/\$\|?\$/g, '')
    .replace(/\$\\vcenter.*?\$\$/g, '')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\hfill/g, '')
    .replace(/\\\\$/gm, '')
    .replace(/\\\\/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract 4-arg commands like \CVSubheading{a}{b}{c}{d} */
export function extractEntries(raw: string, cmdPattern: RegExp): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const matches = [...raw.matchAll(cmdPattern)];
  
  for (const m of matches) {
    // Find bullets between this entry and the next (or end)
    const startIdx = m.index! + m[0].length;
    const nextMatch = matches[matches.indexOf(m) + 1];
    const endIdx = nextMatch ? nextMatch.index! : raw.length;
    const between = raw.substring(startIdx, endIdx);
    
    const bullets: string[] = [];
    const itemMatches = between.matchAll(/\\(?:CVItem|resumeItem)\{([\s\S]*?)\}(?:\s*(?:\\vspace\{[^}]*\})?)/g);
    for (const im of itemMatches) {
      const text = stripLatex(im[1]);
      if (text) bullets.push(text);
    }
    // Also match plain \item
    const plainItems = between.matchAll(/\\item\s+(?!\\)([^\n\\]+)/g);
    for (const pi of plainItems) {
      const text = stripLatex(pi[1]);
      if (text) bullets.push(text);
    }

    entries.push({
      title: stripLatex(m[1]),
      date: stripLatex(m[2]),
      subtitle: stripLatex(m[3]),
      location: stripLatex(m[4]),
      bullets,
    });
  }
  return entries;
}

/** Parse header section for all templates */
export function parseHeader(headerLatex: string): ParsedSection['headerFields'] {
  const fields: ParsedSection['headerFields'] = {};
  
  // Name: look for \Huge or \huge with text, or \cvname{...}
  const cvnameMatch = headerLatex.match(/\\cvname\{([^}]+)\}/);
  if (cvnameMatch) {
    fields.name = stripLatex(cvnameMatch[1]).trim();
  } else {
    const nameMatch = headerLatex.match(/\\(?:Huge|huge)\s*(?:\\scshape\{)?([A-Za-zÀ-ÿ\s.-]+)/);
    if (nameMatch) fields.name = nameMatch[1].trim();
  }
  
  // Phone
  const phoneMatch = headerLatex.match(/(\+?\d[\d\s().-]{6,})/);
  if (phoneMatch) fields.phone = phoneMatch[1].trim();
  
  // Email - from mailto href or \faEnvelope line
  const emailMatch = headerLatex.match(/mailto:([^\s}]+)/);
  if (emailMatch) {
    fields.email = emailMatch[1].trim();
  } else {
    // one_and_half_column: \cvpersonalinfolinewithicon{\faEnvelope}{ email }
    const emailIconMatch = headerLatex.match(/\\faEnvelope\}\s*\{\s*([^}]+)\}/);
    if (emailIconMatch) fields.email = emailIconMatch[1].trim();
  }
  
  // LinkedIn
  const linkedinMatch = headerLatex.match(/linkedin\.com\/in\/([^\s}\\)]+)/);
  if (linkedinMatch) {
    fields.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;
  } else {
    // one_and_half_column: \cvpersonalinfolinewithicon{\faLinkedin}{ handle }
    const linkedinIconMatch = headerLatex.match(/\\faLinkedin\}\s*\{\s*([^}]+)\}/);
    if (linkedinIconMatch) fields.linkedin = linkedinIconMatch[1].trim();
  }
  
  // GitHub
  const githubMatch = headerLatex.match(/github\.com\/([^\s}\\)]+)/);
  if (githubMatch) fields.github = `github.com/${githubMatch[1]}`;
  
  // Website (non-linkedin, non-github href)
  const websiteMatch = headerLatex.match(/\\href\{(https?:\/\/(?!.*(?:linkedin|github|mailto))[^}]+)\}/);
  if (websiteMatch) fields.website = websiteMatch[1];
  
  // Location: rezume template or one_and_half_column (\faMapMarker line)
  const locationMatch = headerLatex.match(/Location:\s*([^\\}\n]+)/);
  if (locationMatch) {
    fields.location = locationMatch[1].trim();
  } else {
    const locIconMatch = headerLatex.match(/\\faMapMarker(?:Alt)?\}\s*\{\s*([^}]+)\}/);
    if (locIconMatch) fields.location = locIconMatch[1].trim();
  }
  
  return fields;
}

/** Parse skills section */
export function parseSkills(raw: string): SkillGroup[] {
  const groups: SkillGroup[] = [];
  
  // Pattern: \textbf{Category}: Values or \textbf{\normalsize{Category:}} \normalsize{Values}
  const matches = raw.matchAll(/\\textbf\{(?:\\normalsize\{)?([^}]+?)(?::?\})?\}\s*\{?:?\}?\s*\{?\s*(?:\\normalsize\{)?([^}\\]+)/g);
  for (const m of matches) {
    const category = m[1].replace(/:$/, '').trim();
    const values = stripLatex(m[2]);
    if (category && values) {
      groups.push({ category, values });
    }
  }
  
  // Rezume template: \resumeSectionType{Category}{:}{Values}
  const rezumeMatches = raw.matchAll(/\\resumeSectionType\{([^}]+)\}\{:\}\{([^}]+)\}/g);
  for (const m of rezumeMatches) {
    // Don't duplicate if already found
    if (!groups.some(g => g.category === m[1].trim())) {
      groups.push({ category: m[1].trim(), values: m[2].trim() });
    }
  }
  
  return groups;
}

/** Parse plain items (projects, publications, certifications as bullet lists) */
function parseItems(raw: string): string[] {
  const items: string[] = [];
  const matches = raw.matchAll(/\\resumeItem\{([\s\S]*?)\}(?:\s*\\vspace)?/g);
  for (const m of matches) {
    const text = stripLatex(m[1]);
    if (text) items.push(text);
  }
  return items;
}

/** Determine section type based on content */
function detectSectionType(name: string, raw: string): ParsedSection['type'] {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('skill') || lowerName.includes('compétence')) return 'skills';
  if (lowerName === 'summary' || lowerName === 'résumé' || lowerName === 'profil') return 'text';
  
  // Has structured entries?
  if (/\\(?:CVSubheading|resumeSubheading|resumeQuadHeading|resumeTrioHeading)\s*\{/i.test(raw)) {
    return 'entries';
  }
  
  // one_and_half_column: \cvitem with \cvtitle inside = entries
  if (/\\cvitem\s*\{/.test(raw) && /\\cvtitle\s*\{/.test(raw)) {
    return 'entries';
  }
  
  // Has only resumeItem / plain items
  if (/\\resumeItem\s*\{/.test(raw) || /\\item\s/.test(raw)) {
    return 'items';
  }
  
  // one_and_half_column: \cvitem with \cvheadingstyle inside = skills
  if (/\\cvitem\s*\{/.test(raw) && /\\cvheadingstyle\s*\{/.test(raw)) {
    return 'skills';
  }
  
  // one_and_half_column: plain \cvitem without \cvtitle = text
  if (/\\cvitem\s*\{/.test(raw) && !/\\cvtitle/.test(raw)) {
    return 'text';
  }
  
  return 'text';
}

/** Main parser: extract all sections from LaTeX code */
export function parseLaTeXSections(latexCode: string): ParsedSection[] {
  if (!latexCode) return [];
  
  const sections: ParsedSection[] = [];
  
  // Find the document body
  const bodyMatch = latexCode.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (!bodyMatch) return [];
  const body = bodyMatch[1];
  
  // Split by \section{...} or \cvsection{...}, preserving section names
  // Handle both \section{Name}, \section{\color{blue}Name}, and \cvsection{Name}
  const sectionRegex = /\\(?:section|cvsection)\{(?:\\color\{[^}]*\})?\s*([^}]+)\}/g;
  const sectionMatches = [...body.matchAll(sectionRegex)];
  
  // Extract header (everything before first \section)
  const firstSectionIdx = sectionMatches.length > 0 ? sectionMatches[0].index! : body.length;
  const headerRaw = body.substring(0, firstSectionIdx);
  
  if (headerRaw.trim()) {
    sections.push({
      id: 'header',
      name: 'Header',
      type: 'header',
      rawLatex: headerRaw,
      headerFields: parseHeader(headerRaw),
      heightRatio: 0.1,
    });
  }
  
  // Process each section
  const totalLines = body.split('\n').length;
  
  for (let i = 0; i < sectionMatches.length; i++) {
    const match = sectionMatches[i];
    const name = match[1].trim();
    const startIdx = match.index!;
    const endIdx = i + 1 < sectionMatches.length 
      ? sectionMatches[i + 1].index! 
      : body.length;
    const rawLatex = body.substring(startIdx, endIdx);
    
    const sectionLines = rawLatex.split('\n').length;
    const heightRatio = Math.max(0.05, sectionLines / totalLines);
    
    const type = detectSectionType(name, rawLatex);
    const section: ParsedSection = {
      id: `section-${i}`,
      name,
      type,
      rawLatex,
      heightRatio,
    };
    
    switch (type) {
      case 'entries': {
        // Try all entry pattern commands
        let entries = extractEntries(rawLatex, /\\CVSubheading\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g);
        if (!entries.length) entries = extractEntries(rawLatex, /\\resumeSubheading\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g);
        if (!entries.length) entries = extractEntries(rawLatex, /\\resumeQuadHeading\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g);
        if (!entries.length) {
          // resumeTrioHeading has 3 args
          const trioMatches = [...rawLatex.matchAll(/\\resumeTrioHeading\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g)];
          entries = trioMatches.map((m, j) => {
            const startI = m.index! + m[0].length;
            const endI = j + 1 < trioMatches.length ? trioMatches[j + 1].index! : rawLatex.length;
            const between = rawLatex.substring(startI, endI);
            const bullets: string[] = [];
            for (const im of between.matchAll(/\\resumeItem\{([\s\S]*?)\}/g)) {
              const t = stripLatex(im[1]);
              if (t) bullets.push(t);
            }
            return {
              title: stripLatex(m[1]),
              subtitle: stripLatex(m[2]),
              date: '',
              location: stripLatex(m[3]),
              bullets,
            };
          });
        }
        // one_and_half_column: \cvitem{\cvdurationstyle{date}}{\cvtitle{title}\n subtitle \begin{itemize}...}
        if (!entries.length) {
          const cvitemRegex = /\\cvitem\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)(?=\\cvitem\s*\{|\\cvsection\s*\{|\\end\{document\}|$)/g;
          const cvitemMatches = [...rawLatex.matchAll(cvitemRegex)];
          for (const m of cvitemMatches) {
            const leftCol = m[1]; // contains \cvdurationstyle{date}
            const rightCol = m[2]; // contains \cvtitle{title}, subtitle, \begin{itemize}...
            
            // Extract date from \cvdurationstyle{...}
            const dateMatch = leftCol.match(/\\cvdurationstyle\{([^}]*)\}/);
            const date = dateMatch ? stripLatex(dateMatch[1]) : stripLatex(leftCol);
            
            // Extract title from \cvtitle{...}
            const titleMatch = rightCol.match(/\\cvtitle\{([^}]*)\}/);
            if (!titleMatch) continue; // skip non-entry cvitems
            const title = stripLatex(titleMatch[1]);
            
            // Extract subtitle (text after \cvtitle{} and before \begin{itemize})
            const afterTitle = rightCol.substring((titleMatch.index || 0) + titleMatch[0].length);
            const subtitleMatch = afterTitle.match(/^\s*([^\\\n][^\n]*)/);
            const subtitle = subtitleMatch ? stripLatex(subtitleMatch[1]) : '';
            
            // Extract bullet points from \begin{itemize}...\end{itemize}
            const bullets: string[] = [];
            const itemizeMatch = rightCol.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
            if (itemizeMatch) {
              const itemMatches = itemizeMatch[1].matchAll(/\\item\s+([^\n\\]+)/g);
              for (const im of itemMatches) {
                const t = stripLatex(im[1]);
                if (t) bullets.push(t);
              }
            }
            
            entries.push({ title, subtitle, date, location: '', bullets });
          }
        }
        section.entries = entries;
        break;
      }
      case 'skills': {
        let groups = parseSkills(rawLatex);
        // one_and_half_column: \cvitem{\cvheadingstyle{Category}}{Values}
        if (!groups.length) {
          const cvSkillMatches = rawLatex.matchAll(/\\cvitem\s*\{\s*\\cvheadingstyle\{([^}]*)\}\s*\}\s*\{\s*([^}]*)\}/g);
          for (const m of cvSkillMatches) {
            const category = m[1].trim();
            const values = stripLatex(m[2]);
            if (category && values) groups.push({ category, values });
          }
        }
        section.skillGroups = groups;
        break;
      }
      case 'items':
        section.items = parseItems(rawLatex);
        break;
      case 'text': {
        // Extract the text content, stripping LaTeX
        const textContent = rawLatex
          .replace(/\\section\{[^}]*\}/g, '')
          .replace(/\\small\{/g, '')
          .replace(/\}$/gm, '');
        section.textContent = stripLatex(textContent);
        break;
      }
    }
    
    sections.push(section);
  }
  
  // Normalize height ratios to sum to 1
  const totalRatio = sections.reduce((s, sec) => s + sec.heightRatio, 0);
  if (totalRatio > 0) {
    for (const sec of sections) {
      sec.heightRatio = sec.heightRatio / totalRatio;
    }
  }
  
  return sections;
}

/** Build a natural language AI instruction from original vs edited section data */
export function buildEditInstruction(
  section: ParsedSection,
  updates: {
    headerFields?: ParsedSection['headerFields'];
    entries?: ParsedEntry[];
    skillGroups?: SkillGroup[];
    textContent?: string;
    items?: string[];
  },
  locale: string
): string {
  const fr = locale === 'fr';
  const parts: string[] = [];
  const sectionLabel = section.name;

  if (section.type === 'header' && updates.headerFields && section.headerFields) {
    const orig = section.headerFields;
    const upd = updates.headerFields;
    if (upd.name && upd.name !== orig.name) parts.push(fr ? `Changer le nom en "${upd.name}"` : `Change name to "${upd.name}"`);
    if (upd.phone && upd.phone !== orig.phone) parts.push(fr ? `Changer le téléphone en "${upd.phone}"` : `Change phone to "${upd.phone}"`);
    if (upd.email && upd.email !== orig.email) parts.push(fr ? `Changer l'email en "${upd.email}"` : `Change email to "${upd.email}"`);
    if (upd.linkedin && upd.linkedin !== orig.linkedin) parts.push(fr ? `Changer LinkedIn en "${upd.linkedin}"` : `Change LinkedIn to "${upd.linkedin}"`);
    if (upd.github && upd.github !== orig.github) parts.push(fr ? `Changer GitHub en "${upd.github}"` : `Change GitHub to "${upd.github}"`);
    if (upd.location && upd.location !== orig.location) parts.push(fr ? `Changer la localisation en "${upd.location}"` : `Change location to "${upd.location}"`);
    if (upd.website && upd.website !== orig.website) parts.push(fr ? `Changer le site web en "${upd.website}"` : `Change website to "${upd.website}"`);
  }

  if (section.type === 'entries' && updates.entries && section.entries) {
    const origEntries = section.entries;
    const newEntries = updates.entries;
    
    // Detect modifications
    for (let i = 0; i < Math.min(origEntries.length, newEntries.length); i++) {
      const o = origEntries[i], n = newEntries[i];
      const changes: string[] = [];
      if (n.title !== o.title) changes.push(fr ? `titre: "${n.title}"` : `title: "${n.title}"`);
      if (n.subtitle !== o.subtitle) changes.push(fr ? `sous-titre: "${n.subtitle}"` : `subtitle: "${n.subtitle}"`);
      if (n.date !== o.date) changes.push(fr ? `date: "${n.date}"` : `date: "${n.date}"`);
      if (n.location !== o.location) changes.push(fr ? `lieu: "${n.location}"` : `location: "${n.location}"`);
      if (JSON.stringify(n.bullets) !== JSON.stringify(o.bullets)) {
        changes.push(fr ? `points: ${n.bullets.map(b => `"${b}"`).join(', ')}` : `bullets: ${n.bullets.map(b => `"${b}"`).join(', ')}`);
      }
      if (changes.length) {
        parts.push(fr
          ? `Dans la section "${sectionLabel}", modifier l'entrée "${o.title}" : ${changes.join(', ')}`
          : `In section "${sectionLabel}", update entry "${o.title}": ${changes.join(', ')}`
        );
      }
    }
    
    // Detect additions
    for (let i = origEntries.length; i < newEntries.length; i++) {
      const n = newEntries[i];
      parts.push(fr
        ? `Dans la section "${sectionLabel}", ajouter une nouvelle entrée : titre "${n.title}", sous-titre "${n.subtitle}", date "${n.date}", lieu "${n.location}"${n.bullets.length ? `, points: ${n.bullets.map(b => `"${b}"`).join(', ')}` : ''}`
        : `In section "${sectionLabel}", add a new entry: title "${n.title}", subtitle "${n.subtitle}", date "${n.date}", location "${n.location}"${n.bullets.length ? `, bullets: ${n.bullets.map(b => `"${b}"`).join(', ')}` : ''}`
      );
    }
    
    // Detect deletions
    for (let i = newEntries.length; i < origEntries.length; i++) {
      const o = origEntries[i];
      parts.push(fr
        ? `Dans la section "${sectionLabel}", supprimer l'entrée "${o.title}"`
        : `In section "${sectionLabel}", remove entry "${o.title}"`
      );
    }
  }

  if (section.type === 'skills' && updates.skillGroups && section.skillGroups) {
    const orig = section.skillGroups;
    const upd = updates.skillGroups;
    
    for (let i = 0; i < Math.min(orig.length, upd.length); i++) {
      if (orig[i].category !== upd[i].category || orig[i].values !== upd[i].values) {
        parts.push(fr
          ? `Dans la section "${sectionLabel}", modifier "${orig[i].category}: ${orig[i].values}" en "${upd[i].category}: ${upd[i].values}"`
          : `In section "${sectionLabel}", change "${orig[i].category}: ${orig[i].values}" to "${upd[i].category}: ${upd[i].values}"`
        );
      }
    }
    for (let i = orig.length; i < upd.length; i++) {
      parts.push(fr
        ? `Dans la section "${sectionLabel}", ajouter la catégorie "${upd[i].category}: ${upd[i].values}"`
        : `In section "${sectionLabel}", add skill category "${upd[i].category}: ${upd[i].values}"`
      );
    }
    for (let i = upd.length; i < orig.length; i++) {
      parts.push(fr
        ? `Dans la section "${sectionLabel}", supprimer la catégorie "${orig[i].category}"`
        : `In section "${sectionLabel}", remove skill category "${orig[i].category}"`
      );
    }
  }

  if (section.type === 'text' && updates.textContent !== undefined && updates.textContent !== section.textContent) {
    parts.push(fr
      ? `Dans la section "${sectionLabel}", remplacer le texte par : "${updates.textContent}"`
      : `In section "${sectionLabel}", replace text with: "${updates.textContent}"`
    );
  }

  if (section.type === 'items' && updates.items && section.items) {
    const added = updates.items.filter(i => !section.items!.includes(i));
    const removed = section.items.filter(i => !updates.items!.includes(i));
    if (added.length) {
      parts.push(fr
        ? `Dans la section "${sectionLabel}", ajouter : ${added.map(i => `"${i}"`).join(', ')}`
        : `In section "${sectionLabel}", add: ${added.map(i => `"${i}"`).join(', ')}`
      );
    }
    if (removed.length) {
      parts.push(fr
        ? `Dans la section "${sectionLabel}", supprimer : ${removed.map(i => `"${i}"`).join(', ')}`
        : `In section "${sectionLabel}", remove: ${removed.map(i => `"${i}"`).join(', ')}`
      );
    }
  }

  return parts.join('. ');
}
