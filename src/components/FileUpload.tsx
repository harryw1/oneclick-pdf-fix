'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProcessingStatus {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  error?: string;
}

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  processing: boolean;
  status?: ProcessingStatus | null;
}

export default function FileUpload({ onFileSelect, processing, status }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB for free tier
    disabled: processing
  });

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="card-modern">
        <div
          {...getRootProps()}
          className={`upload-zone group ${isDragActive ? 'dragover' : ''} ${
            processing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input {...getInputProps()} />
          
          {!selectedFile ? (
            <div className="space-y-4 sm:space-y-6 animate-slide-up">
              <div className="relative">
                <Upload className={`mx-auto h-12 w-12 sm:h-16 sm:w-16 transition-all duration-300 ${
                  isDragActive ? 'text-blue-500 scale-110' : 'text-gray-400 group-hover:text-blue-500 group-hover:scale-105'
                }`} />
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <p className="text-lg sm:text-2xl font-bold text-gray-800">
                  {isDragActive ? '✨ Drop your PDF here' : 'Drag and drop your PDF'}
                </p>
                <p className="text-sm sm:text-base text-gray-600">
                  or tap to browse • Max 10MB (Free) / 100MB (Pro)
                </p>
                <div className="inline-block bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium px-3 py-1 rounded-full">
                  PDF files only
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between animate-slide-up">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <FileText className="h-12 w-12 text-red-500" />
                  <CheckCircle2 className="h-6 w-6 text-green-500 absolute -top-1 -right-1 bg-white rounded-full" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-lg">{selectedFile.name}</p>
                  <p className="text-gray-600">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>
              {!processing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 card-modern border-red-200 bg-red-50 animate-slide-up">
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 font-medium">
                {fileRejections[0].errors[0].message}
              </p>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-6 card-modern animate-slide-up">
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {status.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : status.status === 'error' ? (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-3 border-blue-500 border-t-transparent animate-spin" />
                  )}
                  <p className="font-bold text-lg capitalize text-gray-800">{status.status}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  status.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {status.progress}%
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              
              {status.message && (
                <p className="text-gray-600">{status.message}</p>
              )}
              
              {status.error && (
                <p className="text-red-600 flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{status.error}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}