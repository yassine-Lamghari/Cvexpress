<?php
/**
 * Health Check API
 * 
 * Returns the status of required system dependencies.
 * 
 * GET /api/health.php
 * Response: { "status": "healthy"|"degraded", "dependencies": {...} }
 */

header('Content-Type: application/json');
require_once __DIR__ . '/cors.php';

$dependencies = [];
$allOk = true;

// Check for required binaries
$requiredBinaries = [
    'pdflatex' => 'LaTeX compiler (TeX Live or MiKTeX)',
    'pdftoppm' => 'PDF to image converter (poppler-utils)',
];

foreach ($requiredBinaries as $bin => $description) {
    if (PHP_OS_FAMILY === 'Windows') {
        $result = shell_exec("where $bin 2>NUL");
    } else {
        $result = shell_exec("which $bin 2>/dev/null");
    }
    $found = !empty(trim($result ?? ''));
    $dependencies[$bin] = [
        'found' => $found,
        'description' => $description,
    ];
    if (!$found) {
        $allOk = false;
    }
}

// Check for optional binaries
$optionalBinaries = [
    'magick' => 'ImageMagick (optional, for image processing)',
];

foreach ($optionalBinaries as $bin => $description) {
    if (PHP_OS_FAMILY === 'Windows') {
        $result = shell_exec("where $bin 2>NUL");
    } else {
        $result = shell_exec("which $bin 2>/dev/null");
    }
    $found = !empty(trim($result ?? ''));
    $dependencies[$bin] = [
        'found' => $found,
        'description' => $description,
        'optional' => true,
    ];
}

// Check temp directory is writable
$tmpDir = sys_get_temp_dir();
$tmpWritable = is_writable($tmpDir);
$dependencies['tmp_writable'] = [
    'found' => $tmpWritable,
    'description' => "Temp directory ($tmpDir) is writable",
];
if (!$tmpWritable) {
    $allOk = false;
}

$status = $allOk ? 'healthy' : 'degraded';
http_response_code($allOk ? 200 : 503);

echo json_encode([
    'status' => $status,
    'php_version' => PHP_VERSION,
    'os' => PHP_OS_FAMILY,
    'dependencies' => $dependencies,
], JSON_PRETTY_PRINT);
