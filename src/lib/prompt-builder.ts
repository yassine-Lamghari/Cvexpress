import { Experience, Education, Language, Certification } from "@/types/cv";

export function buildPrompts(
  input: any,
  latexTemplate: string
): [string, string] {
  const candidateName = input.candidateName || '';
  const personalTitle = input.personalTitle || '';
  const piEmail = input.personalInfo?.email || '';
  const piPhone = input.personalInfo?.phone || '';
  const piAddress = input.personalInfo?.address || '';
  const piLinkedin = input.personalInfo?.linkedin || '';
  const piWebsite = input.personalInfo?.website || '';
  const resume = input.resume || '';
  const skills = input.skills || '';
  const experiences = input.experiences || [];
  const stages = input.stages || [];
  const education = input.education || [];
  const languages = input.languages || [];
  const certifications = input.certifications || [];
  const jobOffer = input.jobOffer || '';
  const locale = input.locale || 'fr';

  let filledTemplate = latexTemplate;
  filledTemplate = filledTemplate.replace(/%*(%%NAME%%)%*/g, candidateName);

  const markerMap = {
    "%%TITLE%%": personalTitle,
    "%%EMAIL%%": piEmail,
    "%%PHONE%%": piPhone,
    "%%ADDRESS%%": piAddress,
    "%%LINKEDIN%%": piLinkedin,
    "%%WEBSITE%%": piWebsite
  };

  for (const [marker, value] of Object.entries(markerMap)) {
    if (value) {
      filledTemplate = filledTemplate.replace(new RegExp('%*' + marker.replace(/%%/g, '\\%%') + '%*', 'g'), value);
    } else {
      filledTemplate = filledTemplate.replace(new RegExp('%*' + marker.replace(/%%/g, '\\%%') + '%*', 'g'), '');
    }
  }

  const babelLine = locale === 'fr' ? '\\usepackage[french]{babel}' : '\\usepackage[english]{babel}';
  filledTemplate = filledTemplate.replace(/\\usepackage\[.*?\]\{babel\}/g, babelLine);

  let personalInfoBlock = '';
  if (piEmail) personalInfoBlock += `- Email: ${piEmail}\n`;
  if (piPhone) personalInfoBlock += `- Téléphone: ${piPhone}\n`;
  if (piAddress) personalInfoBlock += `- Adresse: ${piAddress}\n`;
  if (piLinkedin) personalInfoBlock += `- LinkedIn: ${piLinkedin}\n`;
  if (piWebsite) personalInfoBlock += `- Site web: ${piWebsite}\n`;

  const titleLine = personalTitle ? `- Titre professionnel: ${personalTitle}` : '';

  const sectionsToFill = [];
  if (experiences.length === 0) sectionsToFill.push('EXPERIENCE');
  if (stages.length === 0) sectionsToFill.push('STAGES');
  if (education.length === 0) sectionsToFill.push('EDUCATION');
  if (languages.length === 0) sectionsToFill.push('LANGUAGES');
  if (certifications.length === 0) sectionsToFill.push('CERTIFICATIONS');

  let fillSectionsInstruction = '';
  if (sectionsToFill.length > 0) {
    const list = sectionsToFill.join(', ');
    fillSectionsInstruction = `\n\n## SECTIONS SANS DONNÉES STRUCTURÉES
Les sections suivantes n'ont PAS de données structurées fournies: ${list}.
Tu DOIS inventer et créer le contenu nécessaire pour ces sections afin que le CV réponde PARFAITEMENT à l'offre d'emploi. Le CV ne doit JAMAIS paraître vide.`;
  }

  const experiencesJson = JSON.stringify(experiences, null, 2);
  const stagesJson = JSON.stringify(stages, null, 2);
  const educationJson = JSON.stringify(education, null, 2);
  const languagesJson = JSON.stringify(languages, null, 2);
  const certificationsJson = JSON.stringify(certifications, null, 2);

  const systemPrompt = `Tu es un expert en rédaction de CV professionnels ET en LaTeX. Tu reçois un template LaTeX avec des marqueurs %%...%% et les données d'un candidat. Tu dois remplir le template pour qu'il soit PARFAITEMENT adapté à l'offre d'emploi cible.

## L'OFFRE D'EMPLOI EST LA PRIORITÉ ABSOLUE
Ton but premier est de générer un CV qui matche à 100% avec l'offre d'emploi. L'adéquation avec l'offre prime sur toute autre considération.

## RÈGLES DE GESTION DU CONTENU (TRÈS IMPORTANT):
1. **FILTRAGE (S'il y a trop d'informations)** : Si l'utilisateur fournit beaucoup d'expériences ou de compétences, NE LES INCLUS PAS TOUTES. Sélectionne, filtre et conserve UNIQUEMENT les expériences, projets et compétences qui sont strictement pertinents pour l'offre d'emploi. Supprime le superflu.
2. **INVENTION & ENRICHISSEMENT (S'il y a peu d'informations)** : Si l'utilisateur fournit très peu d'informations (ex: une seule expérience, ou juste un profil basique), TU DOIS INVENTER ET COMPLÉTER le CV. Génère de toutes pièces des expériences professionnelles, stages, projets et compétences de A à Z pour remplir entièrement le CV. Le CV final ne doit JAMAIS paraître vide.

Réponds TOUJOURS en ${locale}.

## REGLES LATEX CRITIQUES:
- ECHAPPE IMPERATIVEMENT tous les caractères spéciaux (\\& devient \\\\&, \\% devient \\\\%, \\$ devient \\\\$, etc.)
- VERIFIE bien l'équilibre de toutes tes accolades { }.

Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks.`;

  const userPrompt = `## TEMPLATE LATEX À REMPLIR:
\\n\`\`\`latex\\n${filledTemplate}\\n\`\`\`\\n

## CANDIDAT
- Nom complet: ${candidateName}
${titleLine}
${personalInfoBlock}

## RÉSUMÉ / CV BRUT DU CANDIDAT:
${resume}

## COMPÉTENCES:
${skills}

## EXPÉRIENCES PROFESSIONNELLES:
${experiencesJson}

## STAGES:
${stagesJson}

## FORMATION:
${educationJson}

## LANGUES:
${languagesJson}

## CERTIFICATIONS:
${certificationsJson}

## OFFRE D'EMPLOI CIBLE:
${jobOffer}
${fillSectionsInstruction}

---

## INSTRUCTIONS GÉNÉRALES

Tu dois retourner un JSON avec 3 clés: "latexCode", "motivationLetter", "candidacyEmail".

### latexCode
1. REMPLACE les marqueurs %%...%% par les vraies données.
2. REMPLIS toutes les sections avec des données pertinentes pour l'offre. NE LAISSE aucun marqueur %%...%%.
3. SÉLECTIONNE les expériences existantes si pertinentes. INVENTE de nouvelles expériences et compétences si le candidat n'en fournit pas assez.
4. ADAPTE les descriptions aux mots-clés de l'offre d'emploi (optimisation ATS).
5. ORDONNE les expériences du plus récent au plus ancien.
6. GARDE INTACT tout le préambule LaTeX.

### motivationLetter
- Lettre de motivation de 3-4 paragraphes adaptée à l'offre.
- Mentionne le nom de l'entreprise et le poste dès le premier paragraphe.
- Signe avec "${candidateName}".

### candidacyEmail
- Email court et professionnel.
- Commence par "Objet: Candidature [Titre du poste exact]".
- Signe avec "${candidateName}".

## RÈGLES STRICTES:
- L'ADÉQUATION AVEC L'OFFRE D'EMPLOI EST LA PRIORITÉ ABSOLUE. Filtre ce qui ne sert à rien, invente ce qui manque pour faire un CV parfait.
- Tu dois remplir ENTIÈREMENT la page du CV, ne retourne jamais un template à moitié vide.`;

  return [systemPrompt, userPrompt];
}
