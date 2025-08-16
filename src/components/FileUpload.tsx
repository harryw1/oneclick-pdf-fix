'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import type { ProcessingStatus } from '@/types/pdf';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  processing: boolean;
  status?: ProcessingStatus;
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
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: processing
  });

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`upload-zone ${
          isDragActive ? 'dragover' : ''
        } ${
          processing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        
        {!selectedFile ? (
          <div className="space-y-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop your PDF here' : 'Drag and drop your PDF'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse " Max 100MB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-red-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
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
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            {fileRejections[0].errors[0].message}
          </p>
        </div>
      )}

      {status && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-blue-900 capitalize">{status.status}</p>
            <span className="text-sm text-blue-600">{status.progress}%</span>
          </div>
          
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          
          {status.message && (
            <p className="text-sm text-blue-700 mt-2">{status.message}</p>
          )}
          
          {status.error && (
            <p className="text-sm text-red-600 mt-2">{status.error}</p>
          )}
        </div>
      )}
    </div>
  );
}