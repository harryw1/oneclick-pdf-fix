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

  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  console.log('User profile:', profile, 'Error:', profileError);

  try {
    // Set maxFileSize based on user tier - default to free if profile not found
    const userPlan = profile?.plan || 'free';
    const maxFileSize = userPlan === 'pro' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    
    console.log('User plan:', userPlan, 'Max file size (bytes):', maxFileSize, 'Max file size (MB):', maxFileSize / (1024 * 1024));
    
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: maxFileSize,
      filter: ({ mimetype }) => mimetype === 'application/pdf',
    });

    let fields, files;
    try {
      [fields, files] = await form.parse(req);
    } catch (formError: any) {
      console.error('Formidable parsing error:', formError);
      console.error('Error code:', formError.code);
      console.error('Error message:', formError.message);
      console.error('Full error object:', JSON.stringify(formError, null, 2));
      
      if (formError.code === 'LIMIT_FILE_SIZE' || 
          formError.message?.includes('maxFileSize') || 
          formError.message?.includes('too large')) {
        return res.status(413).json({ 
          error: 'File too large',
          message: `File size exceeds ${userPlan === 'pro' ? '100MB' : '10MB'} limit. ${userPlan === 'free' ? 'Upgrade to Pro for 100MB files.' : ''}`,
          userPlan,
          maxFileSizeMB: maxFileSize / (1024 * 1024),
          actualErrorCode: formError.code,
          actualErrorMessage: formError.message
        });
      }
      throw formError;
    }
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('File uploaded successfully:');
    console.log('- Name:', file.originalFilename);
    console.log('- Size (bytes):', file.size);
    console.log('- Size (MB):', (file.size / (1024 * 1024)).toFixed(2));
    console.log('- MIME type:', file.mimetype);

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