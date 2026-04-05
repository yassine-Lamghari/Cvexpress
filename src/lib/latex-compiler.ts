import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execFileAsync = promisify(execFile);

// Read pdflatex path from env or default to "pdflatex"
const PDFLATEX_BIN = process.env.PDFLATEX_BIN || 'pdflatex';
const PDFTOPPM_BIN = process.env.PDFTOPPM_BIN || 'pdftoppm';
const MAGICK_BIN = process.env.MAGICK_BIN || 'magick';

export async function compileLatex(latexCode: string, photoBase64?: string): Promise<{ pdfPath: string, tmpDir: string }> {
  // Prevent missing latexCode
  if (!latexCode) {
    throw new Error('Latex code is empty');
  }

  latexCode = normalizeLatexInput(latexCode);

  // Basic sanitization
  const forbiddenPatterns = /\\write18\b|\\immediate\s*\\write18|\\input\s*\|/i;
  if (forbiddenPatterns.test(latexCode)) {
    throw new Error('Forbidden commands detected in LaTeX code');
  }

  // Create temporary directory
  const rootTmpBase = path.join(process.cwd(), '.latex_tmp');
  await fs.mkdir(rootTmpBase, { recursive: true });
  
  const jobId = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(rootTmpBase, `job_${jobId}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const texFile = path.join(tmpDir, 'cv.tex');
  const pdfFile = path.join(tmpDir, 'cv.pdf');

  try {
    await fs.writeFile(texFile, latexCode, 'utf-8');

    // Handle photo if provided
    if (photoBase64) {
      const match = photoBase64.match(/^data:image\/(\w+);base64,(.*)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        const data = match[2];
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          ext = ext === 'jpeg' ? 'jpg' : ext;
          const buffer = Buffer.from(data, 'base64');
          await fs.writeFile(path.join(tmpDir, `photo.${ext}`), buffer);
          if (ext !== 'png') {
            await fs.writeFile(path.join(tmpDir, 'photo.png'), buffer); // fallback
          }
        }
      }
    }

    // Compile LaTeX first pass
    try {
      await execFileAsync(PDFLATEX_BIN, ['-no-shell-escape', '-interaction=nonstopmode', 'cv.tex'], { cwd: tmpDir, timeout: 30000 });
    } catch (e: any) {
      // It might still produce a PDF despite errors (underfull hbox, etc.)
    }

    // Compile LaTeX second pass for references
    try {
      await execFileAsync(PDFLATEX_BIN, ['-no-shell-escape', '-interaction=nonstopmode', 'cv.tex'], { cwd: tmpDir, timeout: 30000 });
    } catch (e: any) {
      // Ignored
    }

    try {
      await fs.access(pdfFile);
    } catch {
      let logContent = 'Unknown error';
      try {
        logContent = await fs.readFile(path.join(tmpDir, 'cv.log'), 'utf-8');
      } catch (e) {
        // Ignored
      }
      throw new Error(`Compilation failed. Log: ${logContent.slice(-2000)}`);
    }

    return { pdfPath: pdfFile, tmpDir };
  } catch (error) {
    // Clean up on failure
    await cleanupTmpDir(tmpDir);
    throw error;
  }
}

function normalizeLatexInput(latexCode: string): string {
  let output = latexCode;

  // Strip UTF-8 BOM if present.
  if (output.charCodeAt(0) === 0xfeff) {
    output = output.slice(1);
  }

// Convert escaped newlines from JSON-like strings gently if needed, but not naively replacing \n because of \normalsize
    // JSON.parse already handles the actual newlines.
    if (output.includes('\\\\n')) {
      output = output.replace(/\\\\n/g, '\n');
  }

  output = output.trim();
  output = output.replace(/^```[a-zA-Z]*\s*/i, '').replace(/\s*```$/, '');

  output = normalizeGraphicsNumbers(output);

  return output.trim();
}

function normalizeGraphicsNumbers(latex: string): string {
  let output = latex;

  // Normalize common key=value numeric options anywhere in the document.
  output = output.replace(/\b(scale|xscale|yscale|width|height|totalheight|angle|rotate)\s*=\s*(-?\d+),(?=\d)/g, '$1=$2.');

  output = output.replace(/\\scalebox\s*\{([^}]*)\}(\s*\[[^\]]*\])?\s*\{/g, (match, hscale, opt) => {
    const hClean = normalizeDecimalCommas(hscale);
    let optClean = '';
    if (opt) {
      optClean = opt.replace(/\[([^\]]*)\]/, (_: string, vscale: string) => `[${normalizeDecimalCommas(vscale)}]`);
    }
    return `\\scalebox{${hClean}}${optClean}{`;
  });

  output = output.replace(/\\resizebox\*?\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{/g, (match, width, height) => {
    const wClean = normalizeDecimalCommas(width);
    const hClean = normalizeDecimalCommas(height);
    return match.replace(width, wClean).replace(height, hClean);
  });

  output = output.replace(/\\rotatebox\s*(\[[^\]]*\])?\s*\{([^}]*)\}\s*\{/g, (match, opt, angle) => {
    const angleClean = normalizeDecimalCommas(angle);
    let optClean = opt;
    if (optClean) {
      optClean = optClean.replace(/\[([^\]]*)\]/, (_: string, raw: string) => `[${normalizeDecimalCommas(raw)}]`);
    }
    return `\\rotatebox${optClean || ''}{${angleClean}}{`;
  });

  // Catch custom graphical macros like \sbullet[0,5]
  output = output.replace(/\\(sbullet|cvitem|resumeItem)\s*\[([^\]]*)\]/g, (match, macro, opt) => {
    return `\\${macro}[${normalizeDecimalCommas(opt)}]`;
  });

  output = output.replace(/\\includegraphics\s*\[([^\]]*)\]/g, (match, opts) => {
    return `\\includegraphics[${normalizeIncludeGraphicsOptions(opts)}]`;
  });

  return output;
}

function normalizeIncludeGraphicsOptions(options: string): string {
  const parts = splitByCommaRespectBraces(options);
  const keys = new Set(['scale', 'width', 'height', 'totalheight', 'angle', 'rotate']);

  const normalized = parts.map((part) => {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return trimmed;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!keys.has(key)) return trimmed;

    return `${key}=${normalizeDecimalCommas(value)}`;
  });

  return normalized.join(', ');
}

function splitByCommaRespectBraces(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === '\\' && (next === '{' || next === '}')) {
      current += ch + next;
      i++;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (current) parts.push(current);
  return parts;
}

function normalizeDecimalCommas(value: string): string {
  return value.replace(/(\d+),(\d+)/g, '$1.$2').replace(/(^|[^\d]),(\d+)/g, '$1.$2');
}

export async function generatePreview(pdfPath: string, tmpDir: string): Promise<string> {
  let pngPathRegexFile = '';

  try {
    // Attempt 1: pdftoppm
    try {
      await execFileAsync(PDFTOPPM_BIN, ['-png', '-r', '200', '-f', '1', '-l', '1', 'cv.pdf', 'preview'], { cwd: tmpDir, timeout: 10000 });
      const candidates = ['preview-1.png', 'preview-01.png', 'preview-001.png'];
      for (const c of candidates) {
        try {
          await fs.access(path.join(tmpDir, c));
          pngPathRegexFile = path.join(tmpDir, c);
          break;
        } catch { }
      }
    } catch (e) {
      // Fallback
    }

    // Attempt 2: magick
    if (!pngPathRegexFile) {
      try {
        await execFileAsync(MAGICK_BIN, ['-density', '200', 'cv.pdf[0]', '-quality', '95', 'preview.png'], { cwd: tmpDir, timeout: 10000 });
        pngPathRegexFile = path.join(tmpDir, 'preview.png');
      } catch (e) {
        // Fallback
      }
    }

    if (pngPathRegexFile) {
      const pngBuffer = await fs.readFile(pngPathRegexFile);
      return `data:image/png;base64,${pngBuffer.toString('base64')}`;
    }

    // Absolute fallback: Base64 PDF
    const pdfBuffer = await fs.readFile(pdfPath);
    return `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
  } catch (err: any) {
    throw new Error('Failed to generate preview: ' + err.message);
  }
}

export async function cleanupTmpDir(tmpDir: string) {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch (e) {
    console.error(`Failed to clean up tmp dir ${tmpDir}:`, e);
  }
}


