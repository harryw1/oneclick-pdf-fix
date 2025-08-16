import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  // Check authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  // Get user profile to check tier
  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  try {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB - we'll check user tier separately
      filter: ({ mimetype }) => mimetype === 'application/pdf',
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Check file size limits based on user tier
    const maxFileSize = profile?.plan === 'pro' ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for pro, 10MB for free
    if (file.size > maxFileSize) {
      await fs.unlink(file.filepath); // Clean up uploaded file
      return res.status(413).json({ 
        error: 'File too large', 
        message: profile?.plan === 'pro' 
          ? 'Maximum file size is 100MB' 
          : 'Free tier maximum file size is 10MB. Upgrade to Pro for 100MB files.',
        currentSize: file.size,
        maxSize: maxFileSize
      });
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
    
    // Ensure we always send valid JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}