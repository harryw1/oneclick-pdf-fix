import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filter: ({ mimetype }) => mimetype === 'application/pdf',
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Generate unique processing ID
    const processingId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store file path temporarily
    const tempPath = `/tmp/${processingId}.pdf`;
    await fs.copyFile(file.filepath, tempPath);
    
    // Clean up original upload
    await fs.unlink(file.filepath);

    res.status(200).json({
      processingId,
      originalName: file.originalFilename,
      fileSize: file.size,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}