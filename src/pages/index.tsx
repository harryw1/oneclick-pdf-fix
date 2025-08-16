'use client';

import { useState } from 'react';
import Head from 'next/head';
import FileUpload from '@/components/FileUpload';
import { Download, Zap, Shield, Clock } from 'lucide-react';
import type { ProcessingStatus } from '@/types/pdf';

export default function HomePage() {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = async (file: File) => {
    setProcessing(true);
    setStatus({
      id: 'temp',
      status: 'uploading',
      progress: 0,
      message: 'Uploading PDF...'
    });

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const { processingId } = await uploadResponse.json();
      
      setStatus({
        id: processingId,
        status: 'processing',
        progress: 50,
        message: 'Processing PDF...'
      });

      // Process PDF
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingId,
          options: {
            rotate: 0,
            deskew: true,
            compress: true,
            ocr: true
          }
        }),
      });
      
      if (!processResponse.ok) {
        throw new Error('Processing failed');
      }
      
      const processResult = await processResponse.json();
      
      setStatus({
        id: processingId,
        status: 'completed',
        progress: 100,
        message: 'PDF processed successfully!'
      });
      
      setResult(processResult.result);
    } catch (error) {
      setStatus({
        id: 'error',
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Processing failed'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>OneClick PDF Fixer - Fix PDFs Instantly</title>
        <meta name="description" content="Fix mis-scanned, sideways PDFs instantly. Rotate, deskew, compress, and make searchable with OCR." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">OneClick PDF Fixer</h1>
              <div className="flex space-x-4">
                <a href="/pricing" className="btn-secondary">Pricing</a>
                <a href="/dashboard" className="btn-primary">Dashboard</a>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Fix Your PDFs in <span className="text-primary-600">One Click</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Drag in a mis-scanned or sideways PDF and get back a copy that's rotated, deskewed, compressed and OCR-searchable.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="text-center">
                <Zap className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Auto-Rotate</p>
              </div>
              <div className="text-center">
                <Shield className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Deskew</p>
              </div>
              <div className="text-center">
                <Download className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Compress</p>
              </div>
              <div className="text-center">
                <Clock className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">OCR Search</p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <FileUpload
            onFileSelect={handleFileSelect}
            processing={processing}
            status={status}
          />

          {/* Download Result */}
          {result && (
            <div className="mt-8 p-6 bg-white rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">PDF Processed Successfully!</h3>
                  <p className="text-sm text-gray-500">
                    {result.pageCount} pages " {(result.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <a
                  href={result.downloadUrl}
                  download
                  className="btn-primary flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          )}

          {/* Free Tier Notice */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Free tier: 10 pages per week " 
              <a href="/pricing" className="text-primary-600 hover:text-primary-700 font-medium">
                Upgrade to Pro
              </a> for unlimited processing
            </p>
          </div>
        </div>
      </div>
    </>
  );
}