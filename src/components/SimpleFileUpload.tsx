import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface SimpleFileUploadProps {
  onFileSelect: (file: File) => Promise<void> | void;
  userPlan?: 'free' | 'pro_monthly' | 'pro_annual';
  disabled?: boolean;
}

export default function SimpleFileUpload({ onFileSelect, userPlan = 'free', disabled = false }: SimpleFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Updated file size limits to match backend: 100MB for Pro, 50MB for free users
  const maxFileSize = (userPlan === 'pro_monthly' || userPlan === 'pro_annual') ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
  const maxFileSizeMB = maxFileSize / (1024 * 1024);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e) => e.code === 'file-too-large')) {
        setError(`File too large. Maximum size is ${maxFileSizeMB}MB.`);
      } else if (rejection.errors.some((e) => e.code === 'file-invalid-type')) {
        setError('Only PDF files are supported.');
      } else {
        setError('File rejected. Please try again.');
      }
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      // Don't auto-upload, wait for user to click Process
    }
  }, [maxFileSizeMB]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: maxFileSize,
    disabled
  });

  if (selectedFile) {
    return (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-4 p-6 bg-green-50 rounded-lg border-2 border-green-200">
          <div className="relative">
            <FileText className="h-12 w-12 text-red-500" />
            <CheckCircle2 className="h-6 w-6 text-green-500 absolute -top-1 -right-1 bg-white rounded-full" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-800">{selectedFile.name}</p>
            <p className="text-sm text-gray-600">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready to process
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            onClick={async () => {
              setIsUploading(true);
              try {
                await onFileSelect(selectedFile);
              } catch (error) {
                console.error('Upload error:', error);
                setError(error instanceof Error ? error.message : 'Upload failed');
              } finally {
                setIsUploading(false);
              }
            }}
            disabled={disabled || isUploading}
            className="bg-primary-600 hover:bg-primary-700 text-white"
          >
            {isUploading ? 'Processing...' : 'Process PDF'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedFile(null);
              setError(null);
            }}
            disabled={disabled || isUploading}
          >
            Choose Different File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          group relative border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-all duration-300
          ${isDragActive 
            ? 'border-primary-400 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="relative">
            <Upload className={`mx-auto h-16 w-16 transition-all duration-300 ${
              isDragActive ? 'text-primary-500 scale-110' : 'text-gray-400 group-hover:text-primary-500 group-hover:scale-105'
            }`} />
            <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          
          <div className="space-y-2">
            <p className="text-xl font-bold text-gray-800">
              {isDragActive ? '✨ Drop your PDF here' : 'Drag and drop your PDF'}
            </p>
            <p className="text-gray-600">
              or click to browse • Max {maxFileSizeMB}MB
            </p>
            <div className="inline-block bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
              PDF files only
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}