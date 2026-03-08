<?php
/**
 * LaTeX Preview API
 * 
 * Receives CVData JSON, compiles LaTeX template, returns PNG preview as base64.
 * 
 * POST /api/latex-preview.php
 * Body: { "data": CVData, "template": "malta" }
 * Response: { "success": true, "preview": "data:image/png;base64,..." }
 */

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

// ── Load config ──
require_once __DIR__ . '/latex-config.php';

// ── Parse request ──
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$template = $input['template'] ?? 'professional';
$latexCode = $input['latexCode'] ?? null;

// ── Validate template name (whitelist to prevent path traversal) ──
$allowedTemplates = ['professional', 'charles', 'rezume'];
if (!in_array($template, $allowedTemplates, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown template: ' . $template]);
    exit;
}

if (empty($latexCode)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing latexCode for template: ' . $template]);
    exit;
}

// ── Create temp directory (local to avoid path-with-spaces issues) ──
$tmpBase = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '.latex_tmp';
if (!is_dir($tmpBase)) {
    mkdir($tmpBase, 0755, true);
}
$tmpDir = realpath($tmpBase) . DIRECTORY_SEPARATOR . 'job_' . bin2hex(random_bytes(8));
if (!mkdir($tmpDir, 0755, true)) {
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
        // Return LaTeX compilation log for debugging
        $logFile = $tmpDir . DIRECTORY_SEPARATOR . 'cv.log';
        $logContent = file_exists($logFile) ? file_get_contents($logFile) : implode("\n", $output);
        throw new \RuntimeException('pdflatex compilation failed. Log: ' . substr($logContent, -2000));
    }

    // ── Convert PDF to PNG ──
    // Use chdir to avoid path-with-spaces issues
    $prevDir2 = getcwd();
    chdir($tmpDir);
    $pngFile = null;

    // Attempt 1: pdftoppm
    exec(PDFTOPPM_BIN . ' -png -r 200 -f 1 -l 1 cv.pdf preview 2>&1', $pngOutput, $pngReturn);

    // pdftoppm outputs: preview-1.png or preview-01.png
    foreach (['preview-1.png', 'preview-01.png', 'preview-001.png'] as $candidate) {
        if (file_exists($candidate)) {
            $pngFile = $tmpDir . DIRECTORY_SEPARATOR . $candidate;
            break;
        }
    }

    // Attempt 2: ImageMagick/magick
    if (!$pngFile) {
        exec(MAGICK_BIN . ' -density 200 cv.pdf[0] -quality 95 preview.png 2>&1', $magickOutput, $magickReturn);

        if (file_exists('preview.png')) {
            $pngFile = $tmpDir . DIRECTORY_SEPARATOR . 'preview.png';
        }
    }
    chdir($prevDir2);

    if (!$pngFile) {
        // Fallback: Return PDF as base64 (frontend can render with <embed>)
        $pdfBase64 = base64_encode(file_get_contents($pdfFile));
        echo json_encode([
            'success' => true,
            'preview' => 'data:application/pdf;base64,' . $pdfBase64,
            'format' => 'pdf',
        ]);
        exit;
    }

    // ── Return PNG as base64 ──
    $pngBase64 = base64_encode(file_get_contents($pngFile));
    echo json_encode([
        'success' => true,
        'preview' => 'data:image/png;base64,' . $pngBase64,
        'format' => 'png',
    ]);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} finally {
    // ── Cleanup temp directory ──
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tmpDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $f) {
        $f->isDir() ? rmdir($f->getRealPath()) : unlink($f->getRealPath());
    }
    rmdir($tmpDir);
}
