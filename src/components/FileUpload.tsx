'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProcessingStatus } from '@/types/pdf';

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
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: processing
  });

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <Card className="overflow-hidden">
        <div
          {...getRootProps()}
          className={cn(
            "upload-zone",
            isDragActive && "dragover",
            processing && "opacity-60 cursor-not-allowed",
            !processing && "cursor-pointer"
          )}
        >
          <input {...getInputProps()} />
          
          {!selectedFile ? (
            <div className="space-y-6 animate-slide-up">
              <div className="relative">
                <Upload className={cn(
                  "mx-auto h-16 w-16 transition-all duration-300",
                  isDragActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary group-hover:scale-105"
                )} />
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-semibold text-foreground">
                  {isDragActive ? '✨ Drop your PDF here' : 'Drag and drop your PDF'}
                </p>
                <p className="text-muted-foreground">
                  or click to browse • Max 100MB
                </p>
                <Badge variant="secondary" className="mx-auto">
                  PDF files only
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between animate-slide-up">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <FileText className="h-10 w-10 text-red-500" />
                  <CheckCircle2 className="h-5 w-5 text-green-500 absolute -top-1 -right-1 bg-background rounded-full" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
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
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {fileRejections.length > 0 && (
        <Card className="mt-4 border-destructive/50 bg-destructive/5 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                {fileRejections[0].errors[0].message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status && (
        <Card className="mt-4 animate-slide-up">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {status.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : status.status === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  )}
                  <p className="font-medium capitalize">{status.status}</p>
                </div>
                <Badge variant={status.status === 'completed' ? 'success' : 'default'}>
                  {status.progress}%
                </Badge>
              </div>
              
              <Progress value={status.progress} className="h-3" />
              
              {status.message && (
                <p className="text-sm text-muted-foreground">{status.message}</p>
              )}
              
              {status.error && (
                <p className="text-sm text-destructive flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{status.error}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}