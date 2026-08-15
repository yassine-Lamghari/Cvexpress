export interface PdfJobData {
  userId: string;
  cvId?: string;
  latexCode: string;
  photo?: string;
  template: string;
  filename: string;
}

export interface PdfJobResult {
  objectKey: string;
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
  checksumSha256: string;
}

export type PdfJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

