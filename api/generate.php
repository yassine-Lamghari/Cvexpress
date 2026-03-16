<?php
header('Content-Type: application/json');
require_once __DIR__ . '/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// --- Configuration ---
$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';

// Load from .env file if env var not set
foreach ([__DIR__ . '/.env', __DIR__ . '/../.env.local', __DIR__ . '/../.env'] as $envFile) {
    if (!empty($GEMINI_API_KEY)) break;
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '#') === 0) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2 && trim($parts[0]) === 'GEMINI_API_KEY') {
                $GEMINI_API_KEY = trim($parts[1]);
            }
        }
    }
}

if (empty($GEMINI_API_KEY)) {
    http_response_code(500);
    echo json_encode(['error' => 'API key not configured']);
    exit;
}

// --- Rate Limiting (file-based) ---
$MAX_REQUESTS = 50;
$WINDOW_SECONDS = 3600; // 1 hour

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ip = explode(',', $ip)[0];
$ip = trim($ip);

$rateLimitDir = sys_get_temp_dir() . '/cv_rate_limit';
if (!is_dir($rateLimitDir)) {
    mkdir($rateLimitDir, 0755, true);
}

$rateLimitFile = $rateLimitDir . '/' . md5($ip) . '.json';
$now = time();
$rateData = ['count' => 0, 'reset' => $now + $WINDOW_SECONDS];

if (file_exists($rateLimitFile)) {
    $rateData = json_decode(file_get_contents($rateLimitFile), true) ?: $rateData;
    if ($now > $rateData['reset']) {
        $rateData = ['count' => 0, 'reset' => $now + $WINDOW_SECONDS];
    }
}

if ($rateData['count'] >= $MAX_REQUESTS) {
    $resetIn = max(0, $rateData['reset'] - $now);
    http_response_code(429);
    echo json_encode([
        'error' => 'Rate limit exceeded. Please try again later.',
        'resetIn' => ceil($resetIn / 60),
    ]);
    exit;
}

$rateData['count']++;
file_put_contents($rateLimitFile, json_encode($rateData), LOCK_EX);

// --- Parse request ---
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$resume = $input['resume'] ?? '';
$skills = $input['skills'] ?? '';
$jobOffer = $input['jobOffer'] ?? '';
$locale = in_array($input['locale'] ?? '', ['fr', 'en'], true) ? $input['locale'] : 'fr';
$template = isset($input['template']) && is_string($input['template']) ? $input['template'] : 'professional';
$candidateName = isset($input['candidateName']) && is_string($input['candidateName']) && trim($input['candidateName']) !== '' ? trim($input['candidateName']) : 'Le candidat';
$personalTitle = isset($input['personalTitle']) && is_string($input['personalTitle']) ? trim($input['personalTitle']) : '';
$experiences = isset($input['experiences']) && is_array($input['experiences']) ? $input['experiences'] : [];
$stages = isset($input['stages']) && is_array($input['stages']) ? $input['stages'] : [];
$education = isset($input['education']) && is_array($input['education']) ? $input['education'] : [];
$languages = isset($input['languages']) && is_array($input['languages']) ? $input['languages'] : [];
$certifications = isset($input['certifications']) && is_array($input['certifications']) ? $input['certifications'] : [];

// --- Extract personal info (structured data from form) ---
$personalInfo = isset($input['personalInfo']) && is_array($input['personalInfo']) ? $input['personalInfo'] : [];
$piEmail = isset($personalInfo['email']) && is_string($personalInfo['email']) ? trim($personalInfo['email']) : '';
$piPhone = isset($personalInfo['phone']) && is_string($personalInfo['phone']) ? trim($personalInfo['phone']) : '';
$piCity = isset($personalInfo['city']) && is_string($personalInfo['city']) ? trim($personalInfo['city']) : '';
$piCountry = isset($personalInfo['country']) && is_string($personalInfo['country']) ? trim($personalInfo['country']) : '';
$piLinkedin = isset($personalInfo['linkedin']) && is_string($personalInfo['linkedin']) ? trim($personalInfo['linkedin']) : '';
$piWebsite = isset($personalInfo['website']) && is_string($personalInfo['website']) ? trim($personalInfo['website']) : '';
$piTitle = isset($personalInfo['title']) && is_string($personalInfo['title']) ? trim($personalInfo['title']) : $personalTitle;

// Build location string
$piLocation = implode(', ', array_filter([$piCity, $piCountry]));

// Check that we have minimum viable input
$hasStructuredData = !empty($experiences) || !empty($education) || !empty($stages);
if (empty($resume) && !$hasStructuredData) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: provide resume text or structured experience/education data']);
    exit;
}
if (empty($skills)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required field: skills']);
    exit;
}
if (empty($jobOffer)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required field: jobOffer']);
    exit;
}

// Length limits to prevent abuse
$MAX_RESUME = 15000;
$MAX_SKILLS = 5000;
$MAX_JOB = 15000;
if (mb_strlen($resume) > $MAX_RESUME || mb_strlen($skills) > $MAX_SKILLS || mb_strlen($jobOffer) > $MAX_JOB) {
    http_response_code(400);
    echo json_encode(['error' => 'Input too long. Max: resume ' . $MAX_RESUME . ', skills ' . $MAX_SKILLS . ', jobOffer ' . $MAX_JOB . ' characters.']);
    exit;
}

// --- Build prompt ---
$lang = ($locale === 'fr') ? 'français' : 'English';

$experiencesJson = !empty($experiences) ? json_encode($experiences, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$stagesJson = !empty($stages) ? json_encode($stages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$educationJson = !empty($education) ? json_encode($education, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$languagesJson = !empty($languages) ? json_encode($languages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$certificationsJson = !empty($certifications) ? json_encode($certifications, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';

$titleLine = $piTitle ? "- Titre professionnel: {$piTitle}" : '';

// Build detailed personal info block for the prompt
$personalInfoBlock = "";
if ($piEmail) $personalInfoBlock .= "- Email: {$piEmail}\n";
if ($piPhone) $personalInfoBlock .= "- Téléphone: {$piPhone}\n";
if ($piLocation) $personalInfoBlock .= "- Localisation: {$piLocation}\n";
if ($piLinkedin) $personalInfoBlock .= "- LinkedIn: {$piLinkedin}\n";
if ($piWebsite) $personalInfoBlock .= "- Site web: {$piWebsite}\n";

// --- Read .tex template ---
$allowedTemplates = ['professional', 'charles', 'rezume', 'modern_image'];
if (!in_array($template, $allowedTemplates, true)) {
    $template = 'professional';
}
$texFile = __DIR__ . '/templates/' . $template . '.tex';
if (!file_exists($texFile)) {
    http_response_code(400);
    echo json_encode(['error' => 'Template file not found: ' . $template]);
    exit;
}
$texTemplate = file_get_contents($texFile);

// --- Section name translations ---
$sectionNames = [];
if ($locale === 'fr') {
    $sectionNames = [
        'SECTION_EDUCATION' => 'Formation',
        'SECTION_EXPERIENCE' => 'Expérience Professionnelle',
        'SECTION_STAGES' => 'Stages',
        'SECTION_SKILLS' => 'Compétences Techniques',
        'SECTION_PROJECTS' => 'Projets',
        'SECTION_CERTIFICATIONS' => 'Certifications',
        'SECTION_LANGUAGES' => 'Langues',
        'SECTION_SUMMARY' => 'Profil',
    ];
    $babelLine = '\\usepackage[french]{babel}';
} else {
    $sectionNames = [
        'SECTION_EDUCATION' => 'Education',
        'SECTION_EXPERIENCE' => 'Work Experience',
        'SECTION_STAGES' => 'Internships',
        'SECTION_SKILLS' => 'Technical Skills',
        'SECTION_PROJECTS' => 'Projects',
        'SECTION_CERTIFICATIONS' => 'Certifications',
        'SECTION_LANGUAGES' => 'Languages',
        'SECTION_SUMMARY' => 'Summary',
    ];
    $babelLine = '\\usepackage[english]{babel}';
}

// --- Pre-fill template markers ---
// Replace babel
$texTemplate = str_replace('%%BABEL_LANG%%', $babelLine, $texTemplate);

// Replace section names
foreach ($sectionNames as $marker => $name) {
    $texTemplate = str_replace('%%' . $marker . '%%', $name, $texTemplate);
}

// --- Determine which sections have data ---
$hasExperiences = !empty($experiences);
$hasStages = !empty($stages);
$hasEducation = !empty($education);
$hasLanguages = !empty($languages);
$hasCertifications = !empty($certifications);

// Build list of sections WITHOUT structured data — AI must fill them from the raw resume/job offer
$sectionsToFill = [];
if (!$hasExperiences) $sectionsToFill[] = 'EXPERIENCE (Expériences professionnelles)';
if (!$hasStages) $sectionsToFill[] = 'STAGES (Stages/Internships)';
if (!$hasEducation) $sectionsToFill[] = 'EDUCATION (Formation)';
if (!$hasLanguages) $sectionsToFill[] = 'LANGUAGES (Langues)';
if (!$hasCertifications) $sectionsToFill[] = 'CERTIFICATIONS';

$fillSectionsInstruction = '';
if (!empty($sectionsToFill)) {
    $list = implode(', ', $sectionsToFill);
    $fillSectionsInstruction = "\n\n## SECTIONS SANS DONNÉES STRUCTURÉES (À REMPLIR DEPUIS LE CV BRUT)\nLes sections suivantes n'ont PAS de données structurées fournies: {$list}.\nTu DOIS quand même les remplir:\n- Extrais les informations du CV brut du candidat ci-dessus.\n- NE JAMAIS INVENTER de fausses expériences, formations ou entreprises. Utilise UNIQUEMENT les informations fournies.\n- Si le CV brut ne contient pas d'informations pour une section, place UN SEUL commentaire LaTeX %% section vide — pas de données fournies et supprime le bloc de section.\n- Pour les langues: ajoute celles mentionnées dans le CV brut ou l'offre d'emploi. S'il n'y a rien, ajoute uniquement la langue du CV (Natif).\n- AUCUN placeholder. Si une section est vraiment vide, SUPPRIME-la du document.";
}

// --- Template-specific instructions ---
$templateInstructions = '';
if ($template === 'charles') {
    $templateInstructions = "
### INSTRUCTIONS SPÉCIFIQUES AU TEMPLATE CHARLES:
- Le HEADER utilise un \\begin{center}...\\end{center} centré (sans photo).
- Les entrées utilisent la commande \\CVSubheading{Titre}{Date}{Sous-titre}{Lieu} avec des \\CVItem{} pour les bullet points.
- Les compétences utilisent \\textbf{Catégorie}{: Valeurs}.
- N'utilise QUE les commandes définies dans le préambule: \\CVSubheading, \\CVItem, \\CVSubItem, \\CVSubHeadingListStart, \\CVSubHeadingListEnd, \\CVItemListStart, \\CVItemListEnd.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin, \\textcolor ou d'autres commandes NON définies dans le préambule.";
} elseif ($template === 'professional') {
    $templateInstructions = "
### INSTRUCTIONS SPÉCIFIQUES AU TEMPLATE PROFESSIONAL:
- Le HEADER est centré avec \\begin{center}.
- Les sections utilisent \\color{headingcolor} devant le titre — GARDE CE FORMAT EXACT.
- RÈGLE CRITIQUE: La commande \\resumeSubheading prend TOUJOURS EXACTEMENT 4 arguments entre accolades: {arg1}{arg2}{arg3}{arg4}. Ne JAMAIS omettre un argument. Si un argument est vide, utilise {}.
- Pour les EXPÉRIENCES: \\resumeSubheading{Titre du poste}{}{Entreprise, Lieu}{Date début -- Date fin} avec \\resumeItem{} pour les bullet points.
- Pour la FORMATION: \\resumeSubheading{Nom de l'institution}{Ville, Pays}{Diplôme -- Spécialisation}{Date début -- Date fin}.
  Exemple EXACT pour la formation:
    \\resumeSubheading
      {Université de Paris}{Paris, France}
      {Master Informatique -- Spécialité Intelligence Artificielle}{Sept. 2022 -- Juin 2024}
  Exemple EXACT pour les expériences:
    \\resumeSubheading
      {Développeur Full Stack}{}
      {Entreprise XYZ, Paris}{Jan. 2023 -- Déc. 2024}
- Les compétences utilisent \\textbf{\\normalsize{Catégorie:}}{ \\normalsize{Valeurs}}.
- Les projets utilisent \\resumeItem{\\normalsize{\\textbf{Titre}, Description.}}.
- N'utilise QUE les commandes définies dans le préambule: \\resumeItem, \\resumeSubheading, \\resumeSingleSubheading, \\resumeSubSubheading, \\resumeProjectHeading, \\resumeSubItem, \\resumeSubHeadingListStart, \\resumeSubHeadingListEnd, \\resumeItemListStart, \\resumeItemListEnd, \\sbullet, \\color{headingcolor}, \\color{blue}.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin car fontawesome5 utilise une syntaxe différente. Pour les icônes, utilise simplement du texte ou des séparateurs comme ~ \\small{-} ~.
- NE CRÉE PAS de nouvelles commandes (\\newcommand) dans le corps du document.";
} elseif ($template === 'rezume') {
    $templateInstructions = "
### INSTRUCTIONS SPÉCIFIQUES AU TEMPLATE REZUME:
- Le HEADER est un tabular* à 2 colonnes (nom+liens à gauche, localisation+contact à droite).
- La section Summary (%%SUMMARY_TEXT%%) doit contenir un résumé professionnel adapté à l'offre (2-3 phrases percutantes).
- Les entrées utilisent \\resumeQuadHeading{Titre}{Date}{Sous-titre}{Lieu} avec \\resumeItem{}.
- Les compétences utilisent \\resumeSectionType{Catégorie}{:}{Valeurs}.
- Les projets utilisent \\resumeTrioHeading{Nom}{Technologies}{Lien}.
- Les langues utilisent \\resumeSectionType{Langue}{:}{Niveau}.
- N'utilise QUE les commandes définies dans le préambule: \\resumeItem, \\resumeQuadHeading, \\resumeQuadHeadingChild, \\resumeTrioHeading, \\resumeSectionType, \\resumeHeadingListStart, \\resumeHeadingListEnd, \\resumeItemListStart, \\resumeItemListEnd.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin, \\textcolor ou d'autres commandes NON définies dans le préambule.";
}

$systemPrompt = "Tu es un expert en rédaction de CV professionnels ET en LaTeX. Tu reçois un template LaTeX avec des marqueurs %%...%% et les données d'un candidat. Tu dois remplir le template en respectant cette HIÉRARCHIE DE PRIORITÉ:

## HIÉRARCHIE DES SOURCES DE DONNÉES (STRICTE):
1. **PRIORITÉ ABSOLUE — Données structurées de l'utilisateur**: Les informations personnelles (nom, email, téléphone, ville), les expériences, la formation, les langues et certifications fournis via le formulaire sont SACRÉES. Ne les modifie JAMAIS, ne les supprime JAMAIS. Utilise-les TELLES QUELLES comme base.
2. **PRIORITÉ 2 — CV brut de l'utilisateur**: Extrais toute information complémentaire du texte brut fourni par le candidat.
3. **PRIORITÉ 3 — Enrichissement depuis l'offre d'emploi**: ADAPTE et REFORMULE les descriptions des expériences et compétences pour correspondre aux mots-clés de l'offre d'emploi (optimisation ATS). Ajoute des bullet points pertinents, des métriques chiffrées, des verbes d'action.

## RÈGLE ABSOLUE — NE JAMAIS INVENTER:
- N'INVENTE JAMAIS de fausses expériences professionnelles, entreprises, formations ou écoles.
- N'INVENTE JAMAIS de faux diplômes, certifications ou projets.
- Tu peux REFORMULER, ENRICHIR et ADAPTER les données fournies par l'utilisateur, mais tu ne dois JAMAIS créer de nouvelles entrées fictives.
- Si une section n'a pas de données, SUPPRIME-la du document au lieu de la remplir avec du contenu inventé.
- Les SEULES choses que tu peux créer: des bullet points descriptifs pour des expériences RÉELLES fournies par le candidat, un résumé professionnel synthétisant le profil.

## RÈGLES SUR LES DONNÉES PERSONNELLES:
- NE MODIFIE JAMAIS le nom, email, téléphone fournis par l'utilisateur.
- Si l'email/téléphone ne sont PAS fournis, utilise un placeholder réaliste (prenom.nom@email.com, +33 6 XX XX XX XX).
- Si LinkedIn/GitHub ne sont PAS fournis, SUPPRIME ces lignes du header.
- La localisation: utilise celle du candidat si fournie, sinon déduis depuis l'offre d'emploi.

Réponds TOUJOURS en {$lang}. Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks.";

$userPrompt = <<<PROMPT
## TEMPLATE LATEX À REMPLIR:
```latex
{$texTemplate}
```

## CANDIDAT
- Nom complet: {$candidateName}
{$titleLine}
{$personalInfoBlock}

## RÉSUMÉ / CV BRUT DU CANDIDAT:
{$resume}

## COMPÉTENCES:
{$skills}

## EXPÉRIENCES PROFESSIONNELLES:
{$experiencesJson}

## STAGES:
{$stagesJson}

## FORMATION:
{$educationJson}

## LANGUES:
{$languagesJson}

## CERTIFICATIONS:
{$certificationsJson}

## OFFRE D'EMPLOI CIBLE:
{$jobOffer}
{$fillSectionsInstruction}

---

## INSTRUCTIONS GÉNÉRALES

Tu dois retourner un JSON avec 3 clés: "latexCode", "motivationLetter", "candidacyEmail".

### latexCode — Comment remplir le template

1. **REMPLACER LES MARQUEURS %%...%%**:
   - %%CANDIDATE_NAME%% → Nom complet du candidat (UTILISE EXACTEMENT le nom fourni)
   - %%PHONE%% → Numéro de téléphone (UTILISE celui fourni par l'utilisateur. SEULEMENT si non fourni, utilise +33 6 XX XX XX XX)
   - %%EMAIL%% → Adresse email (UTILISE celle fournie par l'utilisateur. SEULEMENT si non fournie, crée prenom.nom@email.com)
   - %%LINKEDIN_HANDLE%% → Identifiant LinkedIn (UTILISE celui fourni. Si NON fourni, SUPPRIME la ligne \\href contenant linkedin)
   - %%GITHUB_HANDLE%% → Identifiant GitHub (UTILISE celui fourni. Si NON fourni, SUPPRIME la ligne \\href contenant github)
   - %%LOCATION%% → Ville, Pays (UTILISE la localisation fournie. Si NON fournie, déduis de l'offre d'emploi)
   - %%SUMMARY_TEXT%% → Résumé professionnel de 2-3 phrases percutantes, adapté à l'offre

2. **REMPLIR TOUTES LES SECTIONS — AUCUNE SECTION VIDE**:
   - Pour chaque section, remplace les entrées placeholder par les vraies données.
   - Les zones marquées "%% REPEAT for each..." indiquent qu'il faut DUPLIQUER le bloc pour chaque entrée.
   - ADAPTE les descriptions à l'offre d'emploi.
   - **SI UNE SECTION N'A PAS DE DONNÉES STRUCTURÉES**: d'abord cherche dans le CV brut du candidat. Si le CV brut ne contient pas ces infos, ALORS complète depuis l'offre d'emploi avec du contenu réaliste et cohérent.
   - **EXPÉRIENCES**: UTILISE les expériences fournies par l'utilisateur comme BASE. Enrichis chaque expérience avec 3-5 bullet points. Chaque bullet point DOIT commencer par un verbe d'action fort (Développé, Conçu, Optimisé, Géré, Implémenté, Déployé, Analysé, Automatisé...). ADAPTE les descriptions pour inclure les mots-clés de l'offre d'emploi. Ajoute des métriques chiffrées quand possible (ex: +30\% de performance, 500 utilisateurs). Si AUCUNE expérience n'est fournie (ni structurée ni dans le CV brut), SUPPRIME la section expériences du document.
   - **FORMATION**: UTILISE la formation fournie. Si pas de données dans les formulaires NI dans le CV brut, SUPPRIME la section formation.
   - **COMPÉTENCES**: UTILISE les compétences fournies par l'utilisateur ET ajoute les mots-clés EXACTS de l'offre d'emploi. Organise par catégories pertinentes (Langages, Frameworks, Outils, Soft Skills...).
   - **LANGUES**: Utilise celles fournies par l'utilisateur. Si aucune n'est fournie, déduis celles visibles dans le CV brut. En dernier recours, ajoute UNIQUEMENT la langue du document (Natif).
   - **STAGES**: Si le candidat a des stages fournis, utilise-les. Sinon, supprime le bloc %%BEGIN_SECTION_STAGES%%...%%END_SECTION_STAGES%%.
   - **CERTIFICATIONS**: Si aucune certification n'est fournie ET que le profil ne s'y prête pas, tu peux supprimer le bloc %%BEGIN_SECTION_CERTIFICATIONS%%...%%END_SECTION_CERTIFICATIONS%%.
   - **PROJETS**: Si aucun projet n'est fourni, tu peux supprimer le bloc %%BEGIN_SECTION_PROJECTS%%...%%END_SECTION_PROJECTS%%.
   - NE LAISSE AUCUN marqueur %%...%% dans le document final.
   - NE LAISSE AUCUN placeholder comme "Description here", "Period", "Location", "Start -- End" etc.

3. **QUALITÉ DE RÉDACTION CV PROFESSIONNELLE**:
   - Chaque bullet point: verbe d'action + résultat concret + métriques si possible.
   - Utilise les MOTS-CLÉS EXACTS de l'offre d'emploi dans les descriptions (optimisation ATS).
   - Le résumé professionnel doit faire 2-3 phrases ciblées sur le poste visé.
   - Ordonne les expériences du plus récent au plus ancien.
   - Limite chaque expérience à 3-5 bullet points les plus pertinents pour l'offre.
   - Évite les descriptions génériques — sois SPÉCIFIQUE et CONCRET.

4. **PRÉSERVE LA STRUCTURE LATEX**:
   - GARDE INTACTE tout le préambule: \\documentclass, \\usepackage, les commandes personnalisées (\\CVSubheading, \\resumeItem, etc.).
   - NE MODIFIE PAS les commandes LaTeX custom et les environnements.
   - Le document doit commencer par \\documentclass et finir par \\end{document}.

5. **ÉCHAPPEMENT DES CARACTÈRES SPÉCIAUX**:
   - ÉCHAPPE dans le texte brut: & → \\& , % → \\% , \$ → \\\$ , # → \\# , ~ → \\textasciitilde{} , ^ → \\textasciicircum{}
   - Pour le underscore (_): échappe-le dans le texte brut (_ → \\_) MAIS PAS à l'intérieur des arguments de \\href{} (les URLs doivent garder _ tel quel).
   - EXCEPTION: Les accents français (é, è, ê, à, ù, ç, ô, î, ü, etc.) sont supportés NATIVEMENT par babel — NE LES ÉCHAPPE PAS.
   - EXCEPTION: Les caractères { et } utilisés dans les commandes LaTeX ne doivent PAS être échappés.
   - EXCEPTION: Le signe \$ dans les commandes LaTeX comme \$|\$ ne doit pas être échappé.

6. **RÈGLES DE COMPILATION CRITIQUES**:
   - N'utilise QUE les commandes LaTeX définies dans le préambule du template. Ne crée PAS de nouvelles commandes.
   - N'utilise JAMAIS de commandes fontawesome comme \\faIcon{}, \\faGithub, \\faLinkedin, \\faEnvelope, etc. Utilise du texte simple ou des séparateurs.
   - N'utilise JAMAIS \\textcolor{}{}. Utilise \\color{} qui est défini dans le template.
   - NE MODIFIE PAS et NE SUPPRIME PAS les \\usepackage du préambule.
   - Le résultat DOIT être compilable avec pdflatex sans AUCUNE erreur.

{$templateInstructions}

### motivationLetter
- Lettre de motivation de 3-4 paragraphes, adaptée à l'offre.
- Mentionne le nom de l'entreprise et le poste visé dès le premier paragraphe.
- Met en avant les compétences les plus pertinentes pour le poste.
- Signe avec "{$candidateName}".

### candidacyEmail
- Email de candidature court et professionnel.
- Commence par "Objet: Candidature — [Titre du poste exact depuis l'offre]".
- Signe avec "{$candidateName}".

## RÈGLES STRICTES:
- Les données de l'utilisateur (informations personnelles, expériences, compétences, formation) sont PRIORITAIRES. Ne les ignore JAMAIS.
- ADAPTE et ENRICHIS les expériences de l'utilisateur pour l'offre d'emploi, mais ne les remplace PAS par des inventions.
- N'INVENTE JAMAIS de fausses expériences, formations, entreprises ou diplômes. Enrichis ce qui existe, supprime ce qui manque.
- Signe TOUJOURS avec "{$candidateName}", JAMAIS avec un placeholder.
- AUCUN placeholder entre crochets [xxx] ou marqueur %%xxx%% ne doit rester.
- Tu peux REFORMULER, AMÉLIORER et COMPLÉTER les descriptions existantes.
- Si des sections sont vides et qu'aucune donnée ne peut être extraite, SUPPRIME ces sections au lieu de les inventer.
- Formate les dates en "{$lang}" (ex: Jan. 2020 -- Déc. 2023 en français, Jan 2020 -- Dec 2023 en anglais).
- Chaque bullet point doit commencer par un verbe d'action FORT et faire 1-2 lignes max.
- Les sections avec des données fournies doivent être remplies de manière professionnelle et pertinente.

## FORMAT JSON EXACT:
{
  "latexCode": "string - document LaTeX complet rempli, SANS marqueurs %%...%% restants, TOUTES sections remplies",
  "motivationLetter": "string",
  "candidacyEmail": "string"
}
PROMPT;

// --- Call Gemini API (with model fallback) ---
$geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
$response = null;
$httpCode = 0;
$curlError = '';

foreach ($geminiModels as $geminiModel) {
    $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . $geminiModel . ':generateContent?key=' . urlencode($GEMINI_API_KEY);

    $payload = json_encode([
        'contents' => [
            [
                'role' => 'user',
                'parts' => [['text' => $systemPrompt . "\n\n" . $userPrompt]],
            ],
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 32768,
            'responseMimeType' => 'application/json',
        ],
    ]);

    $ch = curl_init($geminiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 120,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // If success or non-rate-limit error, stop retrying
    if ($httpCode === 200 || ($httpCode !== 429 && !$curlError)) break;
}

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to connect to AI service']);
    exit;
}

if ($httpCode !== 200) {
    $errBody = json_decode($response, true);
    $detail = $errBody['error']['message'] ?? $response;
    http_response_code(502);
    echo json_encode(['error' => 'AI service returned an error', 'detail' => $detail, 'httpCode' => $httpCode]);
    exit;
}

$responseData = json_decode($response, true);
$content = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? '{}';

$parsed = json_decode($content, true);
if (!$parsed) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to parse AI response']);
    exit;
}

// --- Post-process and validate LaTeX output ---
$latexOutput = $parsed['latexCode'] ?? '';

if (!empty($latexOutput)) {
    // Ensure document starts with \documentclass
    $trimmed = ltrim($latexOutput);
    if (strpos($trimmed, 'documentclass') === 0) {
        $latexOutput = '\\' . $trimmed;
    }

    // Block dangerous commands
    $forbiddenPatterns = '/\\\\write18\b|\\\\immediate\s*\\\\write18|\\\\input\s*\|/i';
    if (preg_match($forbiddenPatterns, $latexOutput)) {
        http_response_code(500);
        echo json_encode(['error' => 'Generated LaTeX contains forbidden commands']);
        exit;
    }

    // Validate \documentclass presence
    if (strpos($latexOutput, '\\documentclass') === false) {
        http_response_code(500);
        echo json_encode(['error' => 'AI returned invalid LaTeX (missing documentclass)']);
        exit;
    }

    // --- POST-PROCESSING: Clean up leftover markers ---
    // Strip %%BEGIN_SECTION_*%% and %%END_SECTION_*%% markers but KEEP the content between them
    $latexOutput = preg_replace('/%%BEGIN_SECTION_[A-Z_]+%%\s*\n?/', '', $latexOutput);
    $latexOutput = preg_replace('/%%END_SECTION_[A-Z_]+%%\s*\n?/', '', $latexOutput);

    // Remove any remaining %%...%% markers the AI left behind
    $latexOutput = preg_replace('/%%[A-Z_]+%%/', '', $latexOutput);

    // Remove stray "%% REPEAT" and "%% END REPEAT" comments
    $latexOutput = preg_replace('/^\s*%%\s*(REPEAT|END REPEAT).*$/m', '', $latexOutput);

    // Remove leftover placeholder lines that AI may have kept
    $placeholders = ['Description of achievement or responsibility', 'Description here', 'Period', 'Start -- End', 'Start - End', 'Institution Name', 'Company Name', 'Degree and Specialization', 'Job Title}{}', 'Internship Title}{}', 'Project Title', 'Certification Name', 'Technologies}{}'];
    foreach ($placeholders as $ph) {
        // Only remove if it appears as a standalone placeholder (not part of real content)
        $latexOutput = preg_replace('/^.*' . preg_quote($ph, '/') . '\s*$/m', '', $latexOutput);
    }

    // Fix escaped underscores inside \href{} URLs (AI often escapes _ in URLs which breaks them)
    $latexOutput = preg_replace_callback('/\\\\href\{([^}]+)\}/', function($matches) {
        $url = str_replace('\\_', '_', $matches[1]);
        return '\\href{' . $url . '}';
    }, $latexOutput);

    // Remove undefined fontawesome commands that AI may have introduced
    $latexOutput = preg_replace('/\\\\fa[A-Z][a-zA-Z]*(?:\{[^}]*\})?/', '', $latexOutput);

    // Replace \textcolor{...}{...} with just the text (not defined in templates)
    $latexOutput = preg_replace('/\\\\textcolor\{[^}]*\}\{([^}]*)\}/', '$1', $latexOutput);

    // Clean up excessive blank lines (more than 2 consecutive)
    $latexOutput = preg_replace('/\n{4,}/', "\n\n\n", $latexOutput);

    // Ensure babel is present and correct for the locale
    if (strpos($latexOutput, '\\usepackage[french]{babel}') === false && strpos($latexOutput, '\\usepackage[english]{babel}') === false) {
        // Insert babel before \begin{document}
        $latexOutput = str_replace('\\begin{document}', $babelLine . "\n\\begin{document}", $latexOutput);
    }

    // Ensure document ends with \end{document}
    if (!str_ends_with(rtrim($latexOutput), '\\end{document}')) {
        $latexOutput = rtrim($latexOutput) . "\n\\end{document}";
    }

    // --- Brace balance validation and repair ---
    // Count unescaped braces (skip \{ and \})
    $braceContent = preg_replace('/\\\\[{}]/', '', $latexOutput);
    $openCount = substr_count($braceContent, '{');
    $closeCount = substr_count($braceContent, '}');
    if ($openCount > $closeCount) {
        // Insert missing closing braces before \end{document}
        $missing = $openCount - $closeCount;
        $latexOutput = str_replace('\\end{document}', str_repeat('}', $missing) . "\n\\end{document}", $latexOutput);
    } elseif ($closeCount > $openCount) {
        // Remove extra closing braces from end (before \end{document})
        $extra = $closeCount - $openCount;
        for ($i = 0; $i < $extra; $i++) {
            $pos = strrpos($latexOutput, '}', -(strlen($latexOutput) - strrpos($latexOutput, '\\end{document}') + 1));
            if ($pos !== false) {
                $latexOutput = substr_replace($latexOutput, '', $pos, 1);
            }
        }
    }

    // --- Validate \resumeSubheading has exactly 4 arguments ---
    // Find each \resumeSubheading and ensure it's followed by exactly 4 {...} groups
    $latexOutput = preg_replace_callback(
        '/\\\\resumeSubheading\s*+(\{(?:[^{}]|\{[^{}]*\})*\})\s*+(\{(?:[^{}]|\{[^{}]*\})*\})\s*+(?:(\{(?:[^{}]|\{[^{}]*\})*\})\s*+(\{(?:[^{}]|\{[^{}]*\})*\}))?/',
        function($m) {
            $a1 = $m[1];
            $a2 = $m[2];
            $a3 = isset($m[3]) ? $m[3] : '{}';
            $a4 = isset($m[4]) ? $m[4] : '{}';
            return "\\resumeSubheading" . $a1 . $a2 . "\n      " . $a3 . $a4;
        },
        $latexOutput
    );
}

// --- Return result ---
echo json_encode([
    'success' => true,
    'data' => [
        'latexCode' => $latexOutput,
        'motivationLetter' => $parsed['motivationLetter'] ?? '',
        'candidacyEmail' => $parsed['candidacyEmail'] ?? '',
    ],
    'remaining' => $MAX_REQUESTS - $rateData['count'],
], JSON_UNESCAPED_UNICODE);
