export interface PDFProcessingOptions {
  rotate?: number;
  deskew?: boolean;
  compress?: boolean;
  ocr?: boolean;
  classify?: boolean;
  autoRotate?: boolean;
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
  documentType?: string;
}

export interface ProcessingStatus {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  result?: ProcessedPDF;
  error?: string;
}