import { describe, it, expect } from 'vitest';
import { stripLatex, parseSkills, parseHeader } from './latex-parser';

describe('LaTeX Parser Utils', () => {
    describe('stripLatex', () => {
        it('removes formatting commands', () => {
            expect(stripLatex('\\textbf{Hello}')).toBe('Hello');
            expect(stripLatex('\\textit{World}')).toBe('World');
        });

        it('handles complex math stripping', () => {
            expect(stripLatex('Text $|$ math')).toBe('Text math');
        });

        it('removes spaces and lines correctly', () => {
            expect(stripLatex('line1 \\\\ line2')).toBe('line1 line2');
            expect(stripLatex('first~second')).toBe('first second');
        });
    });

    describe('parseSkills', () => {
        it('parses basic template skills', () => {
            const result = parseSkills('\\textbf{Languages}: English, French');
            expect(result).toHaveLength(1);
            expect(result[0].category).toBe('Languages');
            expect(result[0].values).toBe('English, French');
        });
    });

    describe('parseHeader', () => {
        it('extracts name and contact info', () => {
            const header = `\\Huge \\scshape{Jean Dupont} \\normalsize \\\\
            +33 6 12 34 56 78 \\\\
            \\href{mailto:jean@email.com}{jean@email.com}
            `;
            const headerFields = parseHeader(header);
            expect(headerFields?.name).toBe('Jean Dupont');
            expect(headerFields?.phone).toBe('+33 6 12 34 56 78');
            expect(headerFields?.email).toBe('jean@email.com');
        });
    });
});