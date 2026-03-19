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

$rateLimitDir = sys_get_temp_dir() . '/cv_rate_limit_edit';
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

$latexCode = $input['latexCode'] ?? '';
$instruction = $input['instruction'] ?? '';
$locale = $input['locale'] ?? 'fr';

if (empty($latexCode) || empty($instruction)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: latexCode, instruction']);
    exit;
}

if (!is_string($latexCode) || !is_string($instruction)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid field types']);
    exit;
}

if (mb_strlen($instruction) > 1000) {
    http_response_code(400);
    echo json_encode(['error' => 'Instruction too long (max 1000 characters)']);
    exit;
}

// --- Build prompt ---
$lang = ($locale === 'fr') ? 'français' : 'English';

if ($locale === 'fr') {
    $systemPrompt = "Tu es un éditeur LaTeX expert pour CV professionnels. Tu reçois un document LaTeX complet et une instruction de modification de l'utilisateur. Tu dois appliquer la modification demandée et retourner le document LaTeX COMPLET modifié.

RÈGLES:
- Retourne UNIQUEMENT le code LaTeX modifié, du \\documentclass jusqu'au \\end{document}.
- NE retourne PAS de JSON, pas de markdown, pas de backticks, pas d'explications.
- PRÉSERVE INTÉGRALEMENT le préambule LaTeX: \\documentclass, tous les \\usepackage, et toutes les commandes custom (\\CVSubheading, \\CVItem, \\resumeSubheading, \\resumeItem, \\resumeQuadHeading, \\resumeTrioHeading, \\resumeSectionType, etc.).
- PRÉSERVE la mise en page: marges, espacement, police, taille de police. Ne change que le CONTENU demandé.
- Applique UNIQUEMENT la modification demandée, ne change rien d'autre.
- NE SUPPRIME PAS de sections ou commandes qui ne sont pas mentionnées dans l'instruction.
- Les accents français (é, è, ê, à, ù, ç, etc.) sont supportés nativement par babel — ne les échappe pas.
- Quand tu réécris du contenu de CV, utilise des verbes d'action forts et des métriques chiffrées quand possible.
- AUCUN champ ne doit rester vide après modification.
- Le résultat doit être COMPILABLE avec pdflatex sans erreur.
- Réponds en français pour le contenu textuel.";
} else {
    $systemPrompt = "You are an expert LaTeX CV editor for professional resumes. You receive a complete LaTeX document and a modification instruction from the user. You must apply the requested modification and return the COMPLETE modified LaTeX document.

RULES:
- Return ONLY the modified LaTeX code, from \\documentclass to \\end{document}.
- Do NOT return JSON, markdown, backticks, or explanations.
- PRESERVE the entire LaTeX preamble: \\documentclass, all \\usepackage, and all custom commands (\\CVSubheading, \\CVItem, \\resumeSubheading, \\resumeItem, \\resumeQuadHeading, \\resumeTrioHeading, \\resumeSectionType, etc.).
- PRESERVE the layout: margins, spacing, fonts, font sizes. Change ONLY the requested CONTENT.
- Apply ONLY the requested modification, do not change anything else.
- Do NOT remove sections or commands not mentioned in the instruction.
- When rewriting CV content, use strong action verbs and quantified metrics where possible.
- NO field should be left empty after modifications.
- The result MUST be compilable with pdflatex without errors.
- Respond in English for text content.";
}

$userPrompt = "## DOCUMENT LATEX ACTUEL:\n{$latexCode}\n\n## INSTRUCTION DE MODIFICATION:\n{$instruction}";

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
            'temperature' => 0.7,
            'maxOutputTokens' => 32768,
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
$newLatexCode = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? '';

// --- Post-process ---
// Strip markdown code fences if LLM wrapped the response (handles ```latex, ```tex, ```LaTeX, ```, etc.)
$newLatexCode = preg_replace('/^\s*```[a-zA-Z]*\s*\n?/', '', $newLatexCode);
$newLatexCode = preg_replace('/\n?```\s*$/', '', $newLatexCode);
$newLatexCode = trim($newLatexCode);

// If still wrapped in fences (e.g. multiple layers), strip again
if (preg_match('/^```/', $newLatexCode)) {
    $newLatexCode = preg_replace('/^\s*```[a-zA-Z]*\s*\n?/', '', $newLatexCode);
    $newLatexCode = preg_replace('/\n?```\s*$/', '', $newLatexCode);
    $newLatexCode = trim($newLatexCode);
}

// Ensure document starts with \documentclass
if (!empty($newLatexCode)) {
    $trimmed = ltrim($newLatexCode);
    if (strpos($trimmed, 'documentclass') === 0) {
        $newLatexCode = '\\' . $trimmed;
    }
}

// Validate output
if (empty($newLatexCode) || strpos($newLatexCode, '\\documentclass') === false) {
    http_response_code(500);
    echo json_encode(['error' => 'AI returned invalid LaTeX']);
    exit;
}

// Block dangerous commands
$forbiddenPatterns = '/\\\\write18\b|\\\\immediate\s*\\\\write18|\\\\input\s*\|/i';
if (preg_match($forbiddenPatterns, $newLatexCode)) {
    http_response_code(500);
    echo json_encode(['error' => 'Generated LaTeX contains forbidden commands']);
    exit;
}

// Ensure document ends with \end{document}
if (!str_ends_with(rtrim($newLatexCode), '\\end{document}')) {
    $newLatexCode = rtrim($newLatexCode) . "\n\\end{document}";
}

// --- Return result ---
echo json_encode([
    'success' => true,
    'data' => [
        'latexCode' => $newLatexCode,
    ],
    'remaining' => $MAX_REQUESTS - $rateData['count'],
], JSON_UNESCAPED_UNICODE);
