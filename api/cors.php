<?php
/**
 * CORS Helper
 * 
 * Restricts Access-Control-Allow-Origin to known frontend origins.
 * In production, set the ALLOWED_ORIGIN environment variable to your frontend domain.
 * Falls back to localhost origins for development.
 */

function setCorsHeaders(): void {
    $allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];

    // Production override via environment variable
    $envOrigin = getenv('ALLOWED_ORIGIN');
    if ($envOrigin) {
        $allowedOrigins[] = rtrim($envOrigin, '/');
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } elseif (empty($origin)) {
        // Same-origin requests or tools like curl don't send Origin header
        header('Access-Control-Allow-Origin: http://localhost:3000');
    }

    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma');
}

setCorsHeaders();
