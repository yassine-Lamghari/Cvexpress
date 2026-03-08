<?php
/**
 * LaTeX Download API
 * 
 * Receives CVData JSON, compiles LaTeX template, returns PDF for download.
 * 
 * POST /api/latex-download.php
 * Body: { "data": CVData, "template": "malta" }
 * Response: PDF binary (Content-Type: application/pdf)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Load config ──
require_once __DIR__ . '/latex-config.php';

// ── Parse request ──
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$template = $input['template'] ?? 'professional';
$filename = $input['filename'] ?? 'CV.pdf';
$latexCode = $input['latexCode'] ?? null;

// ── Validate template name (whitelist to prevent path traversal) ──
$allowedTemplates = ['professional', 'charles', 'rezume'];
if (!in_array($template, $allowedTemplates, true)) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Unknown template: ' . $template]);
    exit;
}

if (empty($latexCode)) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Missing latexCode for template: ' . $template]);
    exit;
}

// ── Sanitize filename ──
$filename = preg_replace('/[^a-zA-Z0-9\-_\. àâäéèêëîïôùûüç]/', '', $filename);
if (empty($filename) || !str_ends_with(strtolower($filename), '.pdf')) {
    $filename = 'CV.pdf';
}

// ── Create temp directory (local to avoid path-with-spaces issues) ──
$tmpBase = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '.latex_tmp';
if (!is_dir($tmpBase)) {
    mkdir($tmpBase, 0755, true);
}
$tmpDir = realpath($tmpBase) . DIRECTORY_SEPARATOR . 'job_' . bin2hex(random_bytes(8));
if (!mkdir($tmpDir, 0755, true)) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create temp directory']);
    exit;
}

try {
    $latex = $latexCode;

    if (empty($latex)) {
        throw new \RuntimeException('Template returned empty LaTeX');
    }

    // ── Write .tex file ──
    $texFile = $tmpDir . DIRECTORY_SEPARATOR . 'cv.tex';
    file_put_contents($texFile, $latex);

    // ── Compile LaTeX ──
    // -no-shell-escape prevents \write18 command injection
    // Use chdir to avoid path-with-spaces issues in the cd command
    $prevDir = getcwd();
    chdir($tmpDir);
    
    $cmd = PDFLATEX_BIN . ' -no-shell-escape -interaction=nonstopmode cv.tex 2>&1';

    $output = [];
    $returnCode = 0;
    exec($cmd, $output, $returnCode);
    chdir($prevDir);

    $pdfFile = $tmpDir . DIRECTORY_SEPARATOR . 'cv.pdf';
    if (!file_exists($pdfFile)) {
        $logFile = $tmpDir . DIRECTORY_SEPARATOR . 'cv.log';
        $logContent = file_exists($logFile) ? file_get_contents($logFile) : implode("\n", $output);
        throw new \RuntimeException('LaTeX compilation failed. Log: ' . substr($logContent, -2000));
    }

    // ── Return PDF ──
    $pdfContent = file_get_contents($pdfFile);
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdfContent));
    echo $pdfContent;

} catch (\Throwable $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} finally {
    // ── Cleanup temp directory ──
    if (is_dir($tmpDir)) {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tmpDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($files as $f) {
            $f->isDir() ? rmdir($f->getRealPath()) : unlink($f->getRealPath());
        }
        rmdir($tmpDir);
    }
}
