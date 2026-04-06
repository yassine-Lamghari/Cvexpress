import { describe, it, expect } from 'vitest';
import { escapeLatexText, postProcessLatex, validateBraceBalance, validateResumeSubheading } from './services/latexProcessor';

describe('latex-postprocessor', () => {
  describe('escapeLatexText', () => {
    it('escapes latex special characters', () => {
      expect(escapeLatexText('50% & $10')).toBe('50\\% \\& \\$10');
      expect(escapeLatexText('# _ ^ ~')).toBe('\\# \\_ \\textasciicircum{} \\textasciitilde{}');
      expect(escapeLatexText('\\ { }')).toBe('\\textbackslash{} \\{ \\}');
    });
  });

  describe('postProcessLatex', () => {
    it('prepends \\ to documentclass if missing', () => {
      const res = postProcessLatex('documentclass{article}\n\\begin{document}\\end{document}', 'professional');
      expect(res).toContain('\\documentclass{article}');
    });

    it('removes forbidden commands', () => {
      expect(() => postProcessLatex('\\documentclass{article}\n\\write18{rm -rf /}', 'professional')).toThrow(/forbidden commands/);
    });

    it('throws if documentclass is missing', () => {
      expect(() => postProcessLatex('just some text', 'professional')).toThrow(/missing documentclass/);
    });

    it('removes section markers', () => {
      const input = '\\documentclass{article}\n%%BEGIN_SECTION_XP%%\nSome xp\n%%END_SECTION_XP%%\n\\end{document}';
      const output = postProcessLatex(input, 'professional');
      expect(output).not.toContain('%%BEGIN_SECTION_XP%%');
      expect(output).toContain('Some xp');
    });

    it('removes forced line breaks inside content macros', () => {
      const input = '\\documentclass{article}\n\\begin{document}\n\\resumeItem{First line\\\\ second line\\newline third}\n\\end{document}';
      const output = postProcessLatex(input, 'professional');
      expect(output).toContain('\\resumeItem{First line second line third}');
    });
  });

  describe('validateBraceBalance', () => {
    it('adds missing closing braces at the end', () => {
      const res = validateBraceBalance('\\documentclass{article}\n\\begin{document}\n\\large{Title\n\\end{document}');
      expect(res.endsWith('}\n\\end{document}')).toBe(true);
    });
    
    it('removes extra closing braces before end document', () => {
        const res = validateBraceBalance('\\documentclass{article}\n\\begin{document}\nTitle}\n\\end{document}');
        const open = (res.match(/\{/g) || []).length;
        const close = (res.match(/\}/g) || []).length;
        expect(open).toBe(close);
    });
  });

  describe('validateResumeSubheading', () => {
    it('corrects missing arguments in resumeSubheading macro', () => {
      const input = '\\begin{document}\n\\resumeSubheading{Role}{Company}{Location}\n\\end{document}';
      const output = validateResumeSubheading(input);
      expect(output).toContain('\\resumeSubheading{Role}{Company}{Location}{}');
    });

    it('handles extra arguments correctly by ignoring them or keeping macro valid', () => {
      const input = '\\begin{document}\n\\resumeSubheading{Role}{Company}{Location}{Date}{Extra}\n\\end{document}';
      const output = validateResumeSubheading(input);
      expect(output).toContain('\\resumeSubheading{Role}{Company}{Location}{Date}');
    });
    
    it('leaves correct 4-argument macro untouched', () => {
      const input = '\\begin{document}\n\\resumeSubheading{Role}{Company}{Location}{Date}\n\\end{document}';
      const output = validateResumeSubheading(input);
      expect(output).toContain('\\resumeSubheading{Role}{Company}{Location}{Date}');
    });
  });

  describe('postProcessLatex templates tests', () => {
    it('processes modern_image template specifics', () => {
      const input = '\\documentclass{article}\n\\begin{document}\nSome text\n\\end{document}';
      const output = postProcessLatex(input, 'modern_image');
      expect(output).toContain('Some text');
    });

    it('processes rezume template specifics', () => {
      const input = '\\documentclass{article}\n\\begin{document}\nSome text\n\\end{document}';
      const output = postProcessLatex(input, 'rezume');
      expect(output).toContain('Some text');
    });
  });
});
