'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap, Shield, Compress, Eye, Settings2, CheckCircle2 } from 'lucide-react';

interface ProcessingOptions {
  rotate: number;
  deskew: boolean;
  compress: boolean;
  ocr: boolean;
}

interface PDFProcessorProps {
  processingId: string;
  originalFile: File;
  onProcessComplete: (result: any) => void;
  onError: (error: string) => void;
}

export default function PDFProcessor({ processingId, originalFile, onProcessComplete, onError }: PDFProcessorProps) {
  const [options, setOptions] = useState<ProcessingOptions>({
    rotate: 0,
    deskew: true,
    compress: true,
    ocr: true
  });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');

  const handleProcess = async () => {
    setProcessing(true);
    setProgress(0);
    setStage('Initializing...');

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingId,
          options
        })
      });

      if (!response.ok) {
        throw new Error('Processing failed');
      }

      const result = await response.json();
      onProcessComplete(result.result);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const processingSteps = [
    { icon: Zap, name: 'Auto-Rotate', enabled: options.rotate !== 0 },
    { icon: Shield, name: 'Deskew', enabled: options.deskew },
    { icon: Compress, name: 'Compress', enabled: options.compress },
    { icon: Eye, name: 'OCR', enabled: options.ocr }
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings2 className="h-6 w-6" />
          <span>Processing Options</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{originalFile.name}</p>
              <p className="text-sm text-gray-500">
                {(originalFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <Badge variant="secondary">PDF</Badge>
          </div>
        </div>

        {/* Processing Options */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Processing Steps</h3>
          <div className="grid grid-cols-2 gap-4">
            {processingSteps.map((step) => (
              <div
                key={step.name}
                className={`p-4 border-2 rounded-lg transition-all ${
                  step.enabled 
                    ? 'border-primary-200 bg-primary-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <step.icon className={`h-5 w-5 ${
                    step.enabled ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <span className={`font-medium ${
                    step.enabled ? 'text-primary-900' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                  {step.enabled && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress */}
        {processing && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{stage}</span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Action Button */}
        <Button 
          onClick={handleProcess}
          disabled={processing}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {processing ? 'Processing...' : 'Process PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}