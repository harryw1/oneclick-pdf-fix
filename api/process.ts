import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, degrees } from 'pdf-lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import type { PDFProcessingOptions, ProcessedPDF } from '@/types/pdf';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { processingId, options = {} } = req.body as {
    processingId: string;
    options: PDFProcessingOptions;
  };

  if (!processingId) {
    return res.status(400).json({ error: 'Processing ID required' });
  }

  try {
    const inputPath = `/tmp/${processingId}.pdf`;
    const outputPath = `/tmp/${processingId}_processed.pdf`;

    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    // Load PDF
    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Apply transformations
    if (options.rotate) {
      pages.forEach(page => {
        page.setRotation(degrees(options.rotate || 0));
      });
    }

    // Basic compression by optimizing the PDF structure
    const processedPdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    // Save processed PDF
    await fs.writeFile(outputPath, processedPdfBytes);

    // Get file stats
    const stats = await fs.stat(outputPath);
    
    const result: ProcessedPDF = {
      id: processingId,
      originalName: `${processingId}.pdf`,
      processedUrl: `/api/download/${processingId}`,
      downloadUrl: `/api/download/${processingId}`,
      pageCount: pages.length,
      fileSize: stats.size,
      processedAt: new Date(),
      options,
    };

    // Clean up input file
    await fs.unlink(inputPath);

    res.status(200).json({ result });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
}