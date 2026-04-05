"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompts = buildPrompts;
function buildPrompts(input, latexTemplate) {
    var candidateName = input.candidateName || '';
    var personalTitle = input.personalTitle || '';
    var piEmail = input.piEmail || '';
    var piPhone = input.piPhone || '';
    var piAddress = input.piAddress || '';
    var piLinkedin = input.piLinkedin || '';
    var piWebsite = input.piWebsite || '';
    var resume = input.resume || '';
    var skills = input.skills || '';
    var experiences = input.experiences || [];
    var stages = input.stages || [];
    var education = input.education || [];
    var languages = input.languages || [];
    var certifications = input.certifications || [];
    var jobOffer = input.jobOffer || '';
    var locale = input.locale || 'fr';
    var filledTemplate = latexTemplate;
    filledTemplate = filledTemplate.replace(/%*(%%NAME%%)%*/g, candidateName);
    var markerMap = {
        "%%TITLE%%": personalTitle,
        "%%EMAIL%%": piEmail,
        "%%PHONE%%": piPhone,
        "%%ADDRESS%%": piAddress,
        "%%LINKEDIN%%": piLinkedin,
        "%%WEBSITE%%": piWebsite
    };
    for (var _i = 0, _a = Object.entries(markerMap); _i < _a.length; _i++) {
        var _b = _a[_i], marker = _b[0], value = _b[1];
        if (value) {
            filledTemplate = filledTemplate.replace(new RegExp('%*' + marker.replace(/%%/g, '\\%%') + '%*', 'g'), value);
        }
        else {
            filledTemplate = filledTemplate.replace(new RegExp('%*' + marker.replace(/%%/g, '\\%%') + '%*', 'g'), '');
        }
    }
    var babelLine = locale === 'fr' ? '\\usepackage[french]{babel}' : '\\usepackage[english]{babel}';
    filledTemplate = filledTemplate.replace(/\\usepackage\[.*?\]\{babel\}/g, babelLine);
    var personalInfoBlock = '';
    if (piEmail)
        personalInfoBlock += "- Email: ".concat(piEmail, "\n");
    if (piPhone)
        personalInfoBlock += "- T\u00E9l\u00E9phone: ".concat(piPhone, "\n");
    if (piAddress)
        personalInfoBlock += "- Adresse: ".concat(piAddress, "\n");
    if (piLinkedin)
        personalInfoBlock += "- LinkedIn: ".concat(piLinkedin, "\n");
    if (piWebsite)
        personalInfoBlock += "- Site web: ".concat(piWebsite, "\n");
    var titleLine = personalTitle ? "- Titre professionnel: ".concat(personalTitle) : '';
    var sectionsToFill = [];
    if (experiences.length === 0)
        sectionsToFill.push('EXPERIENCE');
    if (stages.length === 0)
        sectionsToFill.push('STAGES');
    if (education.length === 0)
        sectionsToFill.push('EDUCATION');
    if (languages.length === 0)
        sectionsToFill.push('LANGUAGES');
    if (certifications.length === 0)
        sectionsToFill.push('CERTIFICATIONS');
    var fillSectionsInstruction = '';
    if (sectionsToFill.length > 0) {
        var list = sectionsToFill.join(', ');
        fillSectionsInstruction = "\n\n## SECTIONS SANS DONN\u00C9ES STRUCTUR\u00C9ES\nLes sections suivantes n'ont PAS de donn\u00E9es structur\u00E9es fournies: ".concat(list, ".\nTu DOIS inventer et cr\u00E9er le contenu n\u00E9cessaire pour ces sections afin que le CV r\u00E9ponde PARFAITEMENT \u00E0 l'offre d'emploi. Le CV ne doit JAMAIS para\u00EEtre vide.");
    }
    var experiencesJson = JSON.stringify(experiences, null, 2);
    var stagesJson = JSON.stringify(stages, null, 2);
    var educationJson = JSON.stringify(education, null, 2);
    var languagesJson = JSON.stringify(languages, null, 2);
    var certificationsJson = JSON.stringify(certifications, null, 2);
    var systemPrompt = "Tu es un expert en r\u00E9daction de CV professionnels ET en LaTeX. Tu re\u00E7ois un template LaTeX avec des marqueurs %%...%% et les donn\u00E9es d'un candidat. Tu dois remplir le template pour qu'il soit PARFAITEMENT adapt\u00E9 \u00E0 l'offre d'emploi cible.\n\n## L'OFFRE D'EMPLOI EST LA PRIORIT\u00C9 ABSOLUE\nTon but premier est de g\u00E9n\u00E9rer un CV qui matche \u00E0 100% avec l'offre d'emploi. L'ad\u00E9quation avec l'offre prime sur toute autre consid\u00E9ration.\n\n## R\u00C8GLES DE GESTION DU CONTENU (TR\u00C8S IMPORTANT):\n1. **FILTRAGE (S'il y a trop d'informations)** : Si l'utilisateur fournit beaucoup d'exp\u00E9riences ou de comp\u00E9tences, NE LES INCLUS PAS TOUTES. S\u00E9lectionne, filtre et conserve UNIQUEMENT les exp\u00E9riences, projets et comp\u00E9tences qui sont strictement pertinents pour l'offre d'emploi. Supprime le superflu.\n2. **INVENTION & ENRICHISSEMENT (S'il y a peu d'informations)** : Si l'utilisateur fournit tr\u00E8s peu d'informations (ex: une seule exp\u00E9rience, ou juste un profil basique), TU DOIS INVENTER ET COMPL\u00C9TER le CV. G\u00E9n\u00E8re de toutes pi\u00E8ces des exp\u00E9riences professionnelles, stages, projets et comp\u00E9tences de A \u00E0 Z pour remplir enti\u00E8rement le CV. Le CV final ne doit JAMAIS para\u00EEtre vide.\n\nR\u00E9ponds TOUJOURS en ".concat(locale, ".\n\n## REGLES LATEX CRITIQUES:\n- ECHAPPE IMPERATIVEMENT tous les caract\u00E8res sp\u00E9ciaux (\\& devient \\\\&, \\% devient \\\\%, \\$ devient \\\\$, etc.)\n- VERIFIE bien l'\u00E9quilibre de toutes tes accolades { }.\n\nRetourne UNIQUEMENT du JSON valide, sans markdown, sans backticks.");
    var userPrompt = "## TEMPLATE LATEX \u00C0 REMPLIR:\n\\n```latex\\n".concat(filledTemplate, "\\n```\\n\n\n## CANDIDAT\n- Nom complet: ").concat(candidateName, "\n").concat(titleLine, "\n").concat(personalInfoBlock, "\n\n## R\u00C9SUM\u00C9 / CV BRUT DU CANDIDAT:\n").concat(resume, "\n\n## COMP\u00C9TENCES:\n").concat(skills, "\n\n## EXP\u00C9RIENCES PROFESSIONNELLES:\n").concat(experiencesJson, "\n\n## STAGES:\n").concat(stagesJson, "\n\n## FORMATION:\n").concat(educationJson, "\n\n## LANGUES:\n").concat(languagesJson, "\n\n## CERTIFICATIONS:\n").concat(certificationsJson, "\n\n## OFFRE D'EMPLOI CIBLE:\n").concat(jobOffer, "\n").concat(fillSectionsInstruction, "\n\n---\n\n## INSTRUCTIONS G\u00C9N\u00C9RALES\n\nTu dois retourner un JSON avec 3 cl\u00E9s: \"latexCode\", \"motivationLetter\", \"candidacyEmail\".\n\n### latexCode\n1. REMPLACE les marqueurs %%...%% par les vraies donn\u00E9es.\n2. REMPLIS toutes les sections avec des donn\u00E9es pertinentes pour l'offre. NE LAISSE aucun marqueur %%...%%.\n3. S\u00C9LECTIONNE les exp\u00E9riences existantes si pertinentes. INVENTE de nouvelles exp\u00E9riences et comp\u00E9tences si le candidat n'en fournit pas assez.\n4. ADAPTE les descriptions aux mots-cl\u00E9s de l'offre d'emploi (optimisation ATS).\n5. ORDONNE les exp\u00E9riences du plus r\u00E9cent au plus ancien.\n6. GARDE INTACT tout le pr\u00E9ambule LaTeX.\n\n### motivationLetter\n- Lettre de motivation de 3-4 paragraphes adapt\u00E9e \u00E0 l'offre.\n- Mentionne le nom de l'entreprise et le poste d\u00E8s le premier paragraphe.\n- Signe avec \"").concat(candidateName, "\".\n\n### candidacyEmail\n- Email court et professionnel.\n- Commence par \"Objet: Candidature [Titre du poste exact]\".\n- Signe avec \"").concat(candidateName, "\".\n\n## R\u00C8GLES STRICTES:\n- L'AD\u00C9QUATION AVEC L'OFFRE D'EMPLOI EST LA PRIORIT\u00C9 ABSOLUE. Filtre ce qui ne sert \u00E0 rien, invente ce qui manque pour faire un CV parfait.\n- Tu dois remplir ENTI\u00C8REMENT la page du CV, ne retourne jamais un template \u00E0 moiti\u00E9 vide.");
    return [systemPrompt, userPrompt];
}
