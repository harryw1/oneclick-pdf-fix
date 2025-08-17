import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProcessingStatus {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  result?: any;
  error?: string;
}

export default function ProcessingPage() {
  const [status, setStatus] = useState<ProcessingStatus>({ id: '', status: 'uploading', progress: 0 });
  const [user, setUser] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'pro_monthly' | 'pro_annual'>('free');
  const router = useRouter();
  const { id } = router.query;
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }

      setUser(session.user);
      
      // Get user profile to determine plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single();
      
      setUserPlan(profile?.plan || 'free');
    };

    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!id || !user) return;

    const processingId = Array.isArray(id) ? id[0] : id;
    
    // Start processing
    const startProcessing = async () => {
      try {
        setStatus({ id: processingId, status: 'processing', progress: 10, message: 'Analyzing document...' });

        // Get the blob URL from processing ID (this would need to be stored temporarily)
        // For now, we'll need to pass this through the URL or session storage
        const blobUrl = sessionStorage.getItem(`blob_${processingId}`);
        const originalFileName = sessionStorage.getItem(`filename_${processingId}`);
        
        if (!blobUrl || !originalFileName) {
          throw new Error('Processing session expired. Please upload again.');
        }

        setStatus(prev => ({ ...prev, progress: 30, message: 'Processing document with AI...' }));

        const processResponse = await fetch('/api/process', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            processingId,
            blobUrl,
            originalFileName,
            options: {
              rotate: 0,
              deskew: true,
              compress: true,
              ocr: true,
              classify: true
            }
          })
        });

        if (!processResponse.ok) {
          const errorData = await processResponse.json();
          throw new Error(errorData.error || 'Processing failed');
        }

        setStatus(prev => ({ ...prev, progress: 80, message: 'Finalizing...' }));

        const result = await processResponse.json();
        
        setStatus({
          id: processingId,
          status: 'completed',
          progress: 100,
          message: 'Document processed successfully!',
          result: result.result
        });

        // Clean up session storage
        sessionStorage.removeItem(`blob_${processingId}`);
        sessionStorage.removeItem(`filename_${processingId}`);

        // Redirect to results after a brief delay
        setTimeout(() => {
          router.push(`/results/${processingId}`);
        }, 2000);

      } catch (error) {
        console.error('Processing error:', error);
        setStatus({
          id: processingId,
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    };

    startProcessing();
  }, [id, user, router, supabase]);

  const getStatusIcon = () => {
    switch (status.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      default:
        return <FileText className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (status.status) {
      case 'uploading':
        return 'Uploading your document...';
      case 'processing':
        return status.message || 'Processing your document...';
      case 'completed':
        return 'Document processed successfully!';
      case 'error':
        return status.error || 'An error occurred';
      default:
        return 'Preparing...';
    }
  };

  return (
    <Layout 
      title="Processing PDF - OneClick PDF Fixer"
      description="Your PDF is being processed"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl">
              {status.status === 'error' ? 'Processing Failed' : 'Processing Your PDF'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {status.status !== 'error' && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{status.progress}%</span>
                </div>
                <Progress value={status.progress} className="h-2" />
              </div>
            )}
            
            <div className="text-center">
              <p className="text-lg font-medium mb-2">{getStatusMessage()}</p>
              {status.status === 'processing' && (
                <p className="text-sm text-muted-foreground">
                  Please don't close this window. Processing typically takes 15-45 seconds.
                </p>
              )}
              {status.status === 'completed' && (
                <p className="text-sm text-muted-foreground">
                  Redirecting to your results...
                </p>
              )}
            </div>

            {status.status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-center">{status.error}</p>
                </div>
                <div className="flex space-x-3">
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/upload">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Try Again
                    </Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Info */}
        {status.status === 'processing' && (
          <Card className="mt-8 bg-primary-50/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-primary-800 mb-3">What we're doing:</h3>
              <ul className="space-y-2 text-sm text-primary-700">
                <li>• Analyzing document orientation and text alignment</li>
                <li>• Detecting and correcting skew or rotation issues</li>
                <li>• Optimizing file size while preserving quality</li>
                {(userPlan === 'pro_monthly' || userPlan === 'pro_annual') && (
                  <>
                    <li>• Extracting text with advanced OCR technology</li>
                    <li>• Classifying document type for optimal processing</li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}