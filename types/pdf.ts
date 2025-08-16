export interface PDFProcessingOptions {
  rotate?: number;
  deskew?: boolean;
  compress?: boolean;
  ocr?: boolean;
}

export interface ProcessedPDF {
  id: string;
  originalName: string;
  processedUrl: string;
  downloadUrl: string;
  pageCount: number;
  fileSize: number;
  processedAt: Date;
  options: PDFProcessingOptions;
}

export interface ProcessingStatus {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  result?: ProcessedPDF;
  error?: string;
}