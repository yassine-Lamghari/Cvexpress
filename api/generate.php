<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
$GROQ_API_KEY = getenv('GROQ_API_KEY') ?: '';

// Load from .env file if env var not set
if (empty($GROQ_API_KEY) && file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2 && trim($parts[0]) === 'GROQ_API_KEY') {
            $GROQ_API_KEY = trim($parts[1]);
        }
    }
}

if (empty($GROQ_API_KEY)) {
    http_response_code(500);
    echo json_encode(['error' => 'API key not configured']);
    exit;
}

// --- Rate Limiting (file-based) ---
$MAX_REQUESTS = 5;
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
$locale = $input['locale'] ?? 'fr';
$template = isset($input['template']) && is_string($input['template']) ? $input['template'] : 'professional';
$candidateName = isset($input['candidateName']) && is_string($input['candidateName']) && trim($input['candidateName']) !== '' ? trim($input['candidateName']) : 'Le candidat';
$personalTitle = isset($input['personalTitle']) && is_string($input['personalTitle']) ? trim($input['personalTitle']) : '';
$experiences = isset($input['experiences']) && is_array($input['experiences']) ? $input['experiences'] : [];
$stages = isset($input['stages']) && is_array($input['stages']) ? $input['stages'] : [];
$education = isset($input['education']) && is_array($input['education']) ? $input['education'] : [];
$languages = isset($input['languages']) && is_array($input['languages']) ? $input['languages'] : [];
$certifications = isset($input['certifications']) && is_array($input['certifications']) ? $input['certifications'] : [];

if (empty($resume) || empty($skills) || empty($jobOffer)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: resume, skills, jobOffer']);
    exit;
}

// --- Build prompt ---
$lang = ($locale === 'fr') ? 'français' : 'English';

$experiencesJson = !empty($experiences) ? json_encode($experiences, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$stagesJson = !empty($stages) ? json_encode($stages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$educationJson = !empty($education) ? json_encode($education, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$languagesJson = !empty($languages) ? json_encode($languages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';
$certificationsJson = !empty($certifications) ? json_encode($certifications, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '[]';

$titleLine = $personalTitle ? "- Titre professionnel: {$personalTitle}" : '';

// --- Read .tex template ---
$texFile = __DIR__ . '/templates/' . $template . '.tex';
if (!file_exists($texFile)) {
    http_response_code(400);
    echo json_encode(['error' => 'Template file not found: ' . $template]);
    exit;
}
$texTemplate = file_get_contents($texFile);

$systemPrompt = "Tu es un expert en rédaction de CV professionnels ET en LaTeX. Tu reçois un template LaTeX et les données d'un candidat. Tu dois remplir le template avec les données du candidat, adaptées à l'offre d'emploi cible. Réponds TOUJOURS en {$lang}. Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks.";

    $userPrompt = <<<PROMPT
## TEMPLATE LATEX À REMPLIR:
```latex
{$texTemplate}
```

## CANDIDAT
- Nom: {$candidateName}
{$titleLine}

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

---

## INSTRUCTIONS

Tu dois retourner un JSON avec 3 clés: "latexCode", "motivationLetter", "candidacyEmail".

### latexCode
- Prends le template LaTeX ci-dessus et REMPLACE TOUT le contenu placeholder par les vraies données du candidat.
- GARDE INTACTE toute la structure LaTeX: le préambule (\\documentclass, \\usepackage, les commandes personnalisées, etc.).
- Remplis TOUTES les sections du template avec les données du candidat, adaptées à l'offre.
- AMÉLIORE les descriptions: utilise des verbes d'action, quantifie les résultats.
- Si une section du template n'a pas de données correspondantes, supprime cette section du document.
- ÉCHAPPE correctement tous les caractères spéciaux LaTeX: & → \\& , % → \\% , $ → \\$ , # → \\# , _ → \\_ , { → \\{ , } → \\} , ~ → \\textasciitilde{} , ^ → \\textasciicircum{}
- Le résultat doit être un document LaTeX COMPLET et COMPILABLE.

### motivationLetter
- Lettre de motivation 3-4 paragraphes. Signe avec "{$candidateName}".

### candidacyEmail
- Email de candidature court. Commence par "Objet: ...". Signe avec "{$candidateName}".

## RÈGLES STRICTES:
- Signe TOUJOURS avec "{$candidateName}", JAMAIS avec un placeholder.
- AUCUN placeholder entre crochets.
- NE FABRIQUE PAS de fausses données.
- Le latexCode doit être COMPILABLE avec pdflatex sans erreur.

## FORMAT JSON EXACT:
{
  "latexCode": "string - document LaTeX complet rempli",
  "motivationLetter": "string",
  "candidacyEmail": "string"
}
PROMPT;

// --- Call Groq API ---
$payload = json_encode([
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $userPrompt],
    ],
    'model' => 'llama-3.3-70b-versatile',
    'temperature' => 0.7,
    'max_tokens' => 32768,
    'response_format' => ['type' => 'json_object'],
]);

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $GROQ_API_KEY,
    ],
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to connect to AI service']);
    exit;
}

if ($httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'AI service returned an error']);
    exit;
}

$responseData = json_decode($response, true);
$content = $responseData['choices'][0]['message']['content'] ?? '{}';

$parsed = json_decode($content, true);
if (!$parsed) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to parse AI response']);
    exit;
}

// --- Return result ---
echo json_encode([
    'success' => true,
    'data' => [
        'latexCode' => $parsed['latexCode'] ?? '',
        'motivationLetter' => $parsed['motivationLetter'] ?? '',
        'candidacyEmail' => $parsed['candidacyEmail'] ?? '',
    ],
    'remaining' => $MAX_REQUESTS - $rateData['count'],
], JSON_UNESCAPED_UNICODE);
