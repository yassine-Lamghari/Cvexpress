<?php
/**
 * LaTeX API Configuration
 * 
 * Paths to external binaries used for PDF generation.
 * Adjust these if the executables are not in the system PATH.
 */

// ── Auto-detect or use environment variable ──
function find_binary(string $name, string $envVar): string {
    // 1. Check environment variable
    $fromEnv = getenv($envVar);
    if ($fromEnv && (is_executable($fromEnv) || PHP_OS_FAMILY === 'Windows')) {
        return '"' . $fromEnv . '"';
    }

    // 2. Try common paths (Windows MiKTeX / TeX Live, Linux)
    $candidates = [];
    
    if (PHP_OS_FAMILY === 'Windows') {
        $home = getenv('LOCALAPPDATA') ?: (getenv('USERPROFILE') . '\\AppData\\Local');
        $candidates = [
            // MiKTeX user install
            $home . '\\Programs\\MiKTeX\\miktex\\bin\\x64\\' . $name . '.exe',
            // MiKTeX system install
            'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\' . $name . '.exe',
            // TeX Live common paths
            'C:\\texlive\\2024\\bin\\windows\\' . $name . '.exe',
            'C:\\texlive\\2025\\bin\\windows\\' . $name . '.exe',
        ];

        // For pdftoppm: check MiKTeX bundled poppler
        if ($name === 'pdftoppm') {
            $candidates[] = $home . '\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftoppm.exe';
        }
    } else {
        $candidates = [
            '/usr/bin/' . $name,
            '/usr/local/bin/' . $name,
            '/usr/local/texlive/2024/bin/x86_64-linux/' . $name,
            '/usr/local/texlive/2025/bin/x86_64-linux/' . $name,
        ];
    }

    foreach ($candidates as $path) {
        if (file_exists($path)) {
            return '"' . $path . '"';
        }
    }

    // 3. Fallback: assume it's in PATH
    return $name;
}

// ── Binary paths ──
define('PDFLATEX_BIN', find_binary('pdflatex', 'PDFLATEX_PATH'));
define('PDFTOPPM_BIN', find_binary('pdftoppm', 'PDFTOPPM_PATH'));
define('MAGICK_BIN',   find_binary('magick',   'MAGICK_PATH'));
