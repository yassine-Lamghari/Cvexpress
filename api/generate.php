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
$skills = is_array($skills) ? json_encode($skills) : $skills;
if (is_array($skills)) { $skills = json_encode($skills, JSON_UNESCAPED_UNICODE); }
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

function escape_latex_text(string $text): string {
    $map = [
        '\\' => '\\textbackslash{}',
        '{' => '\\{',
        '}' => '\\}',
        '&' => '\\&',
        '%' => '\\%',
        '$' => '\\$',
        '#' => '\\#',
        '_' => '\\_',
        '^' => '\\textasciicircum{}',
        '~' => '\\textasciitilde{}',
    ];
    return strtr($text, $map);
}

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
if (mb_strlen($resume) > $MAX_RESUME || (is_string($skills) && mb_strlen($skills) > $MAX_SKILLS) || mb_strlen($jobOffer) > $MAX_JOB) {
    http_response_code(400);
    echo json_encode(['error' => 'Input too long. Max: resume ' . $MAX_RESUME . ', skills ' . $MAX_SKILLS . ', jobOffer ' . $MAX_JOB . ' characters.']);
    exit;
}

// --- Build prompt ---
$lang = ($locale === 'fr') ? 'franÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ais' : 'English';

$experiencesJson = !empty($experiences) ? json_encode($experiences, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$stagesJson = !empty($stages) ? json_encode($stages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$educationJson = !empty($education) ? json_encode($education, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$languagesJson = !empty($languages) ? json_encode($languages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$certificationsJson = !empty($certifications) ? json_encode($certifications, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';

$titleLine = $piTitle ? "- Titre professionnel: {$piTitle}" : '';

// Build detailed personal info block for the prompt
$personalInfoBlock = "";
if ($piEmail) $personalInfoBlock .= "- Email: {$piEmail}\n";
if ($piPhone) $personalInfoBlock .= "- TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©phone: {$piPhone}\n";
if ($piLocation) $personalInfoBlock .= "- Localisation: {$piLocation}\n";
if ($piLinkedin) $personalInfoBlock .= "- LinkedIn: {$piLinkedin}\n";
if ($piWebsite) $personalInfoBlock .= "- Site web: {$piWebsite}\n";

// --- Read .tex template ---
$allowedTemplates = ['professional', 'charles', 'rezume', 'modern_image', 'one_and_half_column'];
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
        'SECTION_EXPERIENCE' => 'ExpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rience Professionnelle',
        'SECTION_STAGES' => 'Stages',
        'SECTION_SKILLS' => 'CompÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences Techniques',
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

// Replace personal title (for one_and_half_column template)
if ($piTitle) {
    $safePiTitle = escape_latex_text($piTitle);
    $texTemplate = str_replace('%%PERSONAL_TITLE%%', '\\vspace{1mm}\n\\large\\textbf{\\textcolor{accentcolor}{' . $safePiTitle . '}}\n\\vspace{2mm}', $texTemplate);
} else {
    $texTemplate = str_replace('%%PERSONAL_TITLE%%', '', $texTemplate);
}

// --- Determine which sections have data ---
$hasExperiences = !empty($experiences);
$hasStages = !empty($stages);
$hasEducation = !empty($education);
$hasLanguages = !empty($languages);
$hasCertifications = !empty($certifications);

// Build list of sections WITHOUT structured data ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â AI must fill them from the raw resume/job offer
$sectionsToFill = [];
if (!$hasExperiences) $sectionsToFill[] = 'EXPERIENCE (ExpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences professionnelles)';
if (!$hasStages) $sectionsToFill[] = 'STAGES (Stages/Internships)';
if (!$hasEducation) $sectionsToFill[] = 'EDUCATION (Formation)';
if (!$hasLanguages) $sectionsToFill[] = 'LANGUAGES (Langues)';
if (!$hasCertifications) $sectionsToFill[] = 'CERTIFICATIONS';

$fillSectionsInstruction = '';
if (!empty($sectionsToFill)) {
    $list = implode(', ', $sectionsToFill);
    $fillSectionsInstruction = "\n\n## SECTIONS SANS DONNÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES STRUCTURÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES (ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ REMPLIR DEPUIS LE CV BRUT)\nLes sections suivantes n'ont PAS de donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es structurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es fournies: {$list}.\nTu DOIS quand mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªme les remplir:\n- Extrais les informations du CV brut du candidat ci-dessus.\n- NE JAMAIS INVENTER de fausses expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences, formations ou entreprises. Utilise UNIQUEMENT les informations fournies.\n- Si le CV brut ne contient pas d'informations pour une section, place UN SEUL commentaire LaTeX %% section vide ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pas de donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es fournies et supprime le bloc de section.\n- Pour les langues: ajoute celles mentionnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es dans le CV brut ou l'offre d'emploi. S'il n'y a rien, ajoute uniquement la langue du CV (Natif).\n- AUCUN placeholder. Si une section est vraiment vide, SUPPRIME-la du document.";
}

// --- Template-specific instructions ---
$templateInstructions = '';
if ($template === 'charles') {
    $templateInstructions = "
### INSTRUCTIONS SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIFIQUES AU TEMPLATE CHARLES:
- Le HEADER utilise un \\begin{center}...\\end{center} centrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© (sans photo).
- Les entrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es utilisent la commande \\CVSubheading{Titre}{Date}{Sous-titre}{Lieu} avec des \\CVItem{} pour les bullet points.
- Les compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences utilisent \\textbf{CatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gorie}{: Valeurs}.
- N'utilise QUE les commandes dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule: \\CVSubheading, \\CVItem, \\CVSubItem, \\CVSubHeadingListStart, \\CVSubHeadingListEnd, \\CVItemListStart, \\CVItemListEnd.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin, \\textcolor ou d'autres commandes NON dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule.";
} elseif ($template === 'professional') {
    $templateInstructions = "
### INSTRUCTIONS SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIFIQUES AU TEMPLATE PROFESSIONAL:
- Le HEADER est centrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© avec \\begin{center}.
- Les sections utilisent \\color{headingcolor} devant le titre ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â GARDE CE FORMAT EXACT.
- RÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â GLE CRITIQUE: La commande \\resumeSubheading prend TOUJOURS EXACTEMENT 4 arguments entre accolades: {arg1}{arg2}{arg3}{arg4}. Ne JAMAIS omettre un argument. Si un argument est vide, utilise {}.
- Pour les EXPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RIENCES: \\resumeSubheading{Titre du poste}{}{Entreprise, Lieu}{Date dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©but -- Date fin} avec \\resumeItem{} pour les bullet points.
- Pour la FORMATION: \\resumeSubheading{Nom de l'institution}{Ville, Pays}{DiplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´me -- SpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cialisation}{Date dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©but -- Date fin}.
  Exemple EXACT pour la formation:
    \\resumeSubheading
      {UniversitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de Paris}{Paris, France}
      {Master Informatique -- SpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© Intelligence Artificielle}{Sept. 2022 -- Juin 2024}
  Exemple EXACT pour les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences:
    \\resumeSubheading
      {DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©veloppeur Full Stack}{}
      {Entreprise XYZ, Paris}{Jan. 2023 -- DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©c. 2024}
- Les compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences utilisent \\textbf{\\normalsize{CatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gorie:}}{ \\normalsize{Valeurs}}.
- Les projets utilisent \\resumeItem{\\normalsize{\\textbf{Titre}, Description.}}.
- N'utilise QUE les commandes dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule: \\resumeItem, \\resumeSubheading, \\resumeSingleSubheading, \\resumeSubSubheading, \\resumeProjectHeading, \\resumeSubItem, \\resumeSubHeadingListStart, \\resumeSubHeadingListEnd, \\resumeItemListStart, \\resumeItemListEnd, \\sbullet, \\color{headingcolor}, \\color{blue}.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin car fontawesome5 utilise une syntaxe diffÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rente. Pour les icÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´nes, utilise simplement du texte ou des sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©parateurs comme ~ \\small{-} ~.
- NE CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°E PAS de nouvelles commandes (\\newcommand) dans le corps du document.";
} elseif ($template === 'rezume') {
    $templateInstructions = "
### INSTRUCTIONS SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIFIQUES AU TEMPLATE REZUME:
- Le HEADER est un tabular* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  2 colonnes (nom+liens ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  gauche, localisation+contact ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  droite).
- La section Summary (%%SUMMARY_TEXT%%) doit contenir un rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© professionnel adaptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'offre (2-3 phrases percutantes).
- Les entrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es utilisent \\resumeQuadHeading{Titre}{Date}{Sous-titre}{Lieu} avec \\resumeItem{}.
- Les compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences utilisent \\resumeSectionType{CatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gorie}{:}{Valeurs}.
- Les projets utilisent \\resumeTrioHeading{Nom}{Technologies}{Lien}.
- Les langues utilisent \\resumeSectionType{Langue}{:}{Niveau}.
- N'utilise QUE les commandes dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule: \\resumeItem, \\resumeQuadHeading, \\resumeQuadHeadingChild, \\resumeTrioHeading, \\resumeSectionType, \\resumeHeadingListStart, \\resumeHeadingListEnd, \\resumeItemListStart, \\resumeItemListEnd.
- N'utilise JAMAIS \\faIcon, \\faGithub, \\faLinkedin, \\textcolor ou d'autres commandes NON dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule.";
} elseif ($template === 'one_and_half_column') {
    $templateInstructions = '
### INSTRUCTIONS SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIFIQUES AU TEMPLATE ONE_AND_HALF_COLUMN:
- NE JAMAIS MODIFIER LE PREAMBULE (avant \begin{document}). Le code des commandes comme \cvsection et \cvitem doit rester STRICTEMENT IDENTIQUE et INTACT.
- IMPORTANT: Toutes les accolades ouvertes doivent ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre fermÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es correctement. VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifie tes \begin{itemize} ... \end{itemize} et tes \cvitem{...}{...}.
- Si tu utilises \cvitem{}, n\'oublie JAMAIS de fournir DEUX arguments complets : le premier (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  gauche) et le deuxiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  droite). Exemple : \cvitem{gauche}{droite}. Ne laisse pas de bloc vide ou inachevÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
- Remplace les marqueurs %%CANDIDATE_NAME%%, %%EMAIL%%, %%PHONE%%, etc. par les vraies valeurs..
- Respecte l utilisation de \cvpersonalinfolinewithicon. Ne supprime pas le premier paramÃƒÆ’Ã‚Â¨tre \faMapMarker, \faPhone, etc.
- N\'oublie pas de vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifier que fontawesome5 (\faMapMarker, \faEnvelope, \faPhone) est bien configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© pour les icÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´nes de contact.
- Utilise \cvsection pour les titres de section (en majuscules: WORK EXPERIENCE, EDUCATION, SKILLS).
- Les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences utilisent \cvitem{\cvdurationstyle{...}}{\cvtitle{...}\begin{itemize}...\end{itemize}}.
- N\'invente pas d\'items, remplace les ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ments factices par les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©elles.
- Garde l\'image \IfFileExists{photo.png}... et \IfFileExists{photo.jpg}... dans le block \cvpersonalinfo exactement telle quelle.
';
}

$systemPrompt = "Tu es un expert en rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©daction de CV professionnels ET en LaTeX. Tu reÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ois un template LaTeX avec des marqueurs %%...%% et les donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es d'un candidat. Tu dois remplir le template en respectant cette HIÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RARCHIE DE PRIORITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°:

## HIÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RARCHIE DES SOURCES DE DONNÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES (STRICTE):
1. **PRIORITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° ABSOLUE ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DonnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es structurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es de l'utilisateur**: Les informations personnelles (nom, email, tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©phone, ville), les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences, la formation, les langues et certifications fournis via le formulaire sont SACRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES. Ne les modifie JAMAIS, ne les supprime JAMAIS. Utilise-les TELLES QUELLES comme base.
2. **PRIORITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° 2 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â CV brut de l'utilisateur**: Extrais toute information complÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©mentaire du texte brut fourni par le candidat.
3. **PRIORITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° 3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Enrichissement depuis l'offre d'emploi**: ADAPTE et REFORMULE les descriptions des expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences et compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences pour correspondre aux mots-clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de l'offre d'emploi (optimisation ATS). Ajoute des bullet points pertinents, des mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©triques chiffrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es, des verbes d'action.

## RÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â GLE ABSOLUE ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â NE JAMAIS INVENTER:
- N'INVENTE JAMAIS de fausses expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences professionnelles, entreprises, formations ou ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©coles.
- N'INVENTE JAMAIS de faux diplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´mes, certifications ou projets.
- Tu peux REFORMULER, ENRICHIR et ADAPTER les donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es fournies par l'utilisateur, mais tu ne dois JAMAIS crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er de nouvelles entrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es fictives.
- Si une section n'a pas de donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es, SUPPRIME-la du document au lieu de la remplir avec du contenu inventÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
- Les SEULES choses que tu peux crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er: des bullet points descriptifs pour des expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences RÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ELLES fournies par le candidat, un rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© professionnel synthÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tisant le profil.

## RÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â GLES SUR LES DONNÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES PERSONNELLES:
- NE MODIFIE JAMAIS le nom, email, tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©phone fournis par l'utilisateur.
- Si l'email/tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©phone ne sont PAS fournis, utilise un placeholder rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©aliste (prenom.nom@email.com, +33 6 XX XX XX XX).
- Si LinkedIn/GitHub ne sont PAS fournis, SUPPRIME ces lignes du header.
- La localisation: utilise celle du candidat si fournie, sinon dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duis depuis l'offre d'emploi.

RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ponds TOUJOURS en {$lang}. ## REGLES LATEX CRITIQUES :
- ECHAPPE IMPERATIVEMENT tous les caracteres speciaux (comme & qui devient \&, % qui devient \%, $ qui devient \$, # qui devient \#, _ qui devient \_).
- VERIFIE bien l'equilibre de toutes tes accolades { }. Ne ferme jamais une accolade sans l'avoir ouverte.

Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks.";

$userPrompt = <<<PROMPT
## TEMPLATE LATEX ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ REMPLIR:
```latex
{$texTemplate}
```

## CANDIDAT
- Nom complet: {$candidateName}
{$titleLine}
{$personalInfoBlock}

## RÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°SUMÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° / CV BRUT DU CANDIDAT:
{$resume}

## COMPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°TENCES:
{$skills}

## EXPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RIENCES PROFESSIONNELLES:
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

## INSTRUCTIONS GÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°NÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RALES

Tu dois retourner un JSON avec 3 clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s: "latexCode", "motivationLetter", "candidacyEmail".

### latexCode ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Comment remplir le template

1. **REMPLACER LES MARQUEURS %%...%%**:
   - %%CANDIDATE_NAME%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Nom complet du candidat (UTILISE EXACTEMENT le nom fourni)
   - %%PHONE%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ NumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ro de tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©phone (UTILISE celui fourni par l'utilisateur. SEULEMENT si non fourni, utilise +33 6 XX XX XX XX)
   - %%EMAIL%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Adresse email (UTILISE celle fournie par l'utilisateur. SEULEMENT si non fournie, crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e prenom.nom@email.com)
   - %%LINKEDIN_HANDLE%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Identifiant LinkedIn (UTILISE celui fourni. Si NON fourni, SUPPRIME la ligne \\href contenant linkedin)
   - %%GITHUB_HANDLE%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Identifiant GitHub (UTILISE celui fourni. Si NON fourni, SUPPRIME la ligne \\href contenant github)
   - %%LOCATION%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Ville, Pays (UTILISE la localisation fournie. Si NON fournie, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duis de l'offre d'emploi)
   - %%SUMMARY_TEXT%% ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© professionnel de 2-3 phrases percutantes, adaptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'offre

2. **REMPLIR TOUTES LES SECTIONS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â AUCUNE SECTION VIDE**:
   - Pour chaque section, remplace les entrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es placeholder par les vraies donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es.
   - Les zones marquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es "%% REPEAT for each..." indiquent qu'il faut DUPLIQUER le bloc pour chaque entrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.
   - ADAPTE les descriptions ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'offre d'emploi.
   - **SI UNE SECTION N'A PAS DE DONNÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES STRUCTURÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°ES**: d'abord cherche dans le CV brut du candidat. Si le CV brut ne contient pas ces infos, ALORS complÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨te depuis l'offre d'emploi avec du contenu rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©aliste et cohÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rent.
   - **EXPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°RIENCES**: UTILISE les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences fournies par l'utilisateur comme BASE. Enrichis chaque expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rience avec 3-5 bullet points. Chaque bullet point DOIT commencer par un verbe d'action fort (DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©veloppÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, ConÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§u, OptimisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, GÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, ImplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©mentÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, AnalysÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, AutomatisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©...). ADAPTE les descriptions pour inclure les mots-clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de l'offre d'emploi. Ajoute des mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©triques chiffrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es quand possible (ex: +30\% de performance, 500 utilisateurs). Si AUCUNE expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rience n'est fournie (ni structurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ni dans le CV brut), SUPPRIME la section expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences du document.
   - **FORMATION**: UTILISE la formation fournie. Si pas de donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es dans les formulaires NI dans le CV brut, SUPPRIME la section formation.
   - **COMPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°TENCES**: UTILISE les compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences fournies par l'utilisateur ET ajoute les mots-clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s EXACTS de l'offre d'emploi. Organise par catÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gories pertinentes (Langages, Frameworks, Outils, Soft Skills...).
   - **LANGUES**: Utilise celles fournies par l'utilisateur. Si aucune n'est fournie, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duis celles visibles dans le CV brut. En dernier recours, ajoute UNIQUEMENT la langue du document (Natif).
   - **STAGES**: Si le candidat a des stages fournis, utilise-les. Sinon, supprime le bloc %%BEGIN_SECTION_STAGES%%...%%END_SECTION_STAGES%%.
   - **CERTIFICATIONS**: Si aucune certification n'est fournie ET que le profil ne s'y prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªte pas, tu peux supprimer le bloc %%BEGIN_SECTION_CERTIFICATIONS%%...%%END_SECTION_CERTIFICATIONS%%.
   - **PROJETS**: Si aucun projet n'est fourni, tu peux supprimer le bloc %%BEGIN_SECTION_PROJECTS%%...%%END_SECTION_PROJECTS%%.
   - NE LAISSE AUCUN marqueur %%...%% dans le document final.
   - NE LAISSE AUCUN placeholder comme "Description here", "Period", "Location", "Start -- End" etc.

3. **QUALITÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° DE RÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DACTION CV PROFESSIONNELLE**:
   - Chaque bullet point: verbe d'action + rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sultat concret + mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©triques si possible.
   - Utilise les MOTS-CLÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°S EXACTS de l'offre d'emploi dans les descriptions (optimisation ATS).
   - Le rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sumÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© professionnel doit faire 2-3 phrases ciblÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es sur le poste visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
   - Ordonne les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences du plus rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cent au plus ancien.
   - Limite chaque expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rience ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  3-5 bullet points les plus pertinents pour l'offre.
   - ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°vite les descriptions gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riques ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â sois SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIFIQUE et CONCRET.

4. **PRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°SERVE LA STRUCTURE LATEX**:
   - GARDE INTACTE tout le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule: \\documentclass, \\usepackage, les commandes personnalisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es (\\CVSubheading, \\resumeItem, etc.).
   - NE MODIFIE PAS les commandes LaTeX custom et les environnements.
   - Le document doit commencer par \\documentclass et finir par \\end{document}.

5. **ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CHAPPEMENT DES CARACTÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â RES SPÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CIAUX**:
   - ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CHAPPE dans le texte brut: & ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\& , % ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\% , \$ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\\$ , # ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\# , ~ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\textasciitilde{} , ^ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\textasciicircum{}
   - Pour le underscore (_): ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©chappe-le dans le texte brut (_ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ \\_) MAIS PAS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'intÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rieur des arguments de \\href{} (les URLs doivent garder _ tel quel).
   - EXCEPTION: Les accents franÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ais (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â , ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¹, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â®, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼, etc.) sont supportÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s NATIVEMENT par babel ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â NE LES ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°CHAPPE PAS.
   - EXCEPTION: Les caractÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨res { et } utilisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s dans les commandes LaTeX ne doivent PAS ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©chappÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s.
   - EXCEPTION: Le signe \$ dans les commandes LaTeX comme \$|\$ ne doit pas ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©chappÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.

6. **RÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â GLES DE COMPILATION CRITIQUES**:
   - N'utilise QUE les commandes LaTeX dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©finies dans le prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule du template. Ne crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e PAS de nouvelles commandes.
   - N'utilise JAMAIS de commandes fontawesome comme \\faIcon{}, \\faGithub, \\faLinkedin, \\faEnvelope, etc. Utilise du texte simple ou des sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©parateurs.
   - N'utilise JAMAIS \\textcolor{}{}. Utilise \\color{} qui est dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fini dans le template.
   - NE MODIFIE PAS et NE SUPPRIME PAS les \\usepackage du prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ambule.
   - Le rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sultat DOIT ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre compilable avec pdflatex sans AUCUNE erreur.

{$templateInstructions}

### motivationLetter
- Lettre de motivation de 3-4 paragraphes, adaptÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'offre.
- Mentionne le nom de l'entreprise et le poste visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s le premier paragraphe.
- Met en avant les compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences les plus pertinentes pour le poste.
- Signe avec "{$candidateName}".

### candidacyEmail
- Email de candidature court et professionnel.
- Commence par "Objet: Candidature ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â [Titre du poste exact depuis l'offre]".
- Signe avec "{$candidateName}".

## RÃƒÆ’Ã†â€™Ãƒâ€¹Ã¢â‚¬Â GLES STRICTES:
- Les donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es de l'utilisateur (informations personnelles, expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences, compÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tences, formation) sont PRIORITAIRES. Ne les ignore JAMAIS.
- ADAPTE et ENRICHIS les expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences de l'utilisateur pour l'offre d'emploi, mais ne les remplace PAS par des inventions.
- N'INVENTE JAMAIS de fausses expÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©riences, formations, entreprises ou diplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´mes. Enrichis ce qui existe, supprime ce qui manque.
- Signe TOUJOURS avec "{$candidateName}", JAMAIS avec un placeholder.
- AUCUN placeholder entre crochets [xxx] ou marqueur %%xxx%% ne doit rester.
- Tu peux REFORMULER, AMÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°LIORER et COMPLÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°TER les descriptions existantes.
- Si des sections sont vides et qu'aucune donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ne peut ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre extraite, SUPPRIME ces sections au lieu de les inventer.
- Formate les dates en "{$lang}" (ex: Jan. 2020 -- DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©c. 2023 en franÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ais, Jan 2020 -- Dec 2023 en anglais).
- Chaque bullet point doit commencer par un verbe d'action FORT et faire 1-2 lignes max.
- Les sections avec des donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es fournies doivent ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre remplies de maniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re professionnelle et pertinente.

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
            'temperature' => 0.7, // Augmenté pour éviter de garder le "même historique" et forcer la mise à jour des tournures
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
    $placeholders = ['Description of achievement or responsibility', 'Description here', 'Period', 'Start -- End', 'Start - End', 'Start Date -- End Date', 'Institution Name', 'Company Name', 'Company Name, Location', 'Degree Name', 'Degree and Specialization', 'Job Title', 'Job Title}{}', 'Internship Title}{}', 'Project Title', 'Certification Name', 'Technologies}{}', 'task 1', 'task 2', 'detail 1', 'Skill Category', 'Skill 1, Skill 2, Skill 3', 'Language Name -- Proficiency'];
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
    if ($template !== 'one_and_half_column') { $latexOutput = preg_replace('/\\\\fa[A-Z][a-zA-Z]*(?:\{[^}]*\})?/', '', $latexOutput); }

    // Replace \textcolor{...}{...} with just the text (not defined in templates)
    if ($template !== 'one_and_half_column') { $latexOutput = preg_replace('/\\\\textcolor\{[^}]*\}\{([^}]*)\}/', '$1', $latexOutput); }

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









