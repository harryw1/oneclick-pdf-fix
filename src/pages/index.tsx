'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Zap, Shield, Clock, Star, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import type { ProcessingStatus } from '@/types/pdf';
import { GetServerSideProps } from 'next';

export default function HomePage() {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [result, setResult] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    // Check if this is an auth callback that should go to /auth/confirm
    const checkAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      // Check for auth callback parameters
      const hasAuthParams = 
        urlParams.get('code') ||           // PKCE flow
        urlParams.get('token_hash') || 
        urlParams.get('type') || 
        hashParams.get('access_token') || 
        hashParams.get('refresh_token');
      
      if (hasAuthParams) {
        console.log('Auth callback detected on homepage, redirecting to /auth/confirm');
        // Preserve the URL parameters and redirect
        const newUrl = `/auth/confirm${window.location.search}${window.location.hash}`;
        window.location.href = newUrl;
        return true;
      }
      return false;
    };

    // If this is an auth callback, redirect before doing anything else
    if (checkAuthCallback()) {
      return;
    }

    const supabase = createClient();
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        setAuthToken(session.access_token);
        
        // Get user profile to determine plan
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .single();
        
        setUserPlan(profile?.plan || 'free');
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          setAuthToken(session.access_token);
          
          // Get user profile for plan
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', session.user.id)
            .single();
          
          setUserPlan(profile?.plan || 'free');
        } else {
          setUser(null);
          setAuthToken(null);
          setUserPlan('free');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleFileSelect = async (file: File) => {
    console.log('=== FILE UPLOAD STARTED ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });
    console.log('User state:', {
      authenticated: !!user,
      userId: user?.id,
      email: user?.email,
      hasAuthToken: !!authToken,
      userPlan: userPlan
    });

    // Check if user is authenticated
    if (!user || !authToken) {
      console.error('Authentication check failed:', { user: !!user, authToken: !!authToken });
      setStatus({
        id: 'auth_error',
        status: 'error',
        progress: 0,
        error: 'Please sign in to process PDFs'
      });
      return;
    }

    setProcessing(true);
    setStatus({
      id: 'temp',
      status: 'uploading',
      progress: 10,
      message: 'Uploading your PDF...'
    });

    try {
      // Upload file directly to Vercel Blob
      console.log('Starting direct blob upload...');
      const { upload } = await import('@vercel/blob/client');
      
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
        clientPayload: JSON.stringify({
          userId: user.id,
          userPlan: userPlan
        })
      });
      
      console.log('Blob upload successful:', {
        url: blob.url,
        pathname: blob.pathname
      });
      
      const processingId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('Processing ID generated:', processingId);
      
      setStatus({
        id: processingId,
        status: 'processing',
        progress: 60,
        message: 'Processing your PDF with AI...'
      });

      // Process PDF using blob URL
      console.log('=== STARTING PDF PROCESSING ===');
      console.log('Processing ID:', processingId);
      console.log('Blob URL:', blob.url);
      
      const processController = new AbortController();
      const processTimeout = setTimeout(() => processController.abort(), 120000); // 2 minute timeout
      
      const processPayload = {
        processingId,
        blobUrl: blob.url,
        originalFileName: file.name,
        options: {
          rotate: 0,
          deskew: true,
          compress: true,
          ocr: true
        }
      };
      console.log('Process request payload:', processPayload);
      
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(processPayload),
        signal: processController.signal,
      });
      
      clearTimeout(processTimeout);
      console.log('Process response received:', {
        status: processResponse.status,
        statusText: processResponse.statusText,
        headers: Object.fromEntries(processResponse.headers.entries())
      });
      
      if (!processResponse.ok) {
        let errorData;
        let responseText = '';
        
        try {
          responseText = await processResponse.text();
          console.log('Process error response text:', responseText);
          errorData = JSON.parse(responseText);
          console.log('Process error data:', errorData);
        } catch (parseError) {
          console.error('Failed to parse process error response:', parseError);
          console.log('Raw process error response was:', responseText);
          throw new Error(`Processing failed with status ${processResponse.status}`);
        }
        throw new Error(errorData.error || errorData.message || 'Processing failed');
      }
      
      let processResult;
      try {
        const responseText = await processResponse.text();
        console.log('Process success response text:', responseText);
        processResult = JSON.parse(responseText);
        console.log('Process success data:', processResult);
      } catch (parseError) {
        console.error('Failed to parse process success response:', parseError);
        throw new Error('Invalid response from server');
      }
      
      console.log('=== PROCESSING COMPLETED SUCCESSFULLY ===');
      console.log('Final result:', processResult.result);
      
      setStatus({
        id: processingId,
        status: 'completed',
        progress: 100,
        message: 'Your PDF has been fixed and is ready to download!'
      });
      
      setResult(processResult.result);
    } catch (error) {
      console.error('=== ERROR OCCURRED ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Full error object:', error);
      
      let errorMessage = 'Something went wrong. Please try again.';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please try again with a smaller file.';
          console.log('Request was aborted due to timeout');
        } else {
          errorMessage = error.message;
        }
      }
      
      console.log('Final error message shown to user:', errorMessage);
      
      setStatus({
        id: 'error',
        status: 'error',
        progress: 0,
        error: errorMessage
      });
    } finally {
      console.log('=== PROCESSING FINISHED ===');
      setProcessing(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: "Smart Rotate",
      description: "Auto-detects and fixes orientation",
      color: "text-yellow-500"
    },
    {
      icon: Shield,
      title: "Deskew",
      description: "Straightens crooked documents",
      color: "text-green-500"
    },
    {
      icon: Download,
      title: "Compress",
      description: "Reduces file size intelligently",
      color: "text-blue-500"
    },
    {
      icon: Clock,
      title: "OCR Ready",
      description: "Makes text fully searchable",
      color: "text-purple-500"
    }
  ];

  return (
    <>
      <Head>
        <title>OneClick PDF Fixer - Fix PDFs Instantly</title>
        <meta name="description" content="Fix mis-scanned, sideways PDFs instantly. Rotate, deskew, compress, and make searchable with OCR." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50">
        {/* Header */}
        <header className="glass-effect border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  OneClick PDF Fixer
                </h1>
              </div>
              <div className="flex space-x-2 sm:space-x-3">
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <a href="/pricing">Pricing</a>
                </Button>
                {user ? (
                  <Button size="sm" asChild>
                    <a href="/dashboard">Dashboard</a>
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <a href="/auth">Sign In</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Star className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Trusted by 10,000+ users</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight px-2">
              Fix Your PDFs in{' '}
              <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                One Click
              </span>
            </h2>
            
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-4">
              Transform crooked, sideways, or messy scanned PDFs into perfectly readable documents. 
              No software downloads — just drag, drop, and download your fixed PDF in seconds.
            </p>
            
            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-12 sm:mb-16">
              {features.map((feature, index) => (
                <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 animate-slide-up border-0 bg-white/50 backdrop-blur-sm" style={{ animationDelay: `${index * 100}ms` }}>
                  <CardContent className="p-3 sm:p-6 text-center">
                    <feature.icon className={cn("h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 sm:mb-3 transition-transform group-hover:scale-110", feature.color)} />
                    <h3 className="font-semibold text-foreground mb-1 text-sm sm:text-base">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div className="mb-16">
            {user ? (
              <FileUpload
                onFileSelect={handleFileSelect}
                processing={processing}
                status={status}
                userPlan={userPlan}
              />
            ) : (
              <Card className="max-w-2xl mx-auto">
                <CardContent className="p-8 text-center">
                  <h3 className="text-xl font-bold mb-4">Ready to fix your PDFs?</h3>
                  <p className="text-gray-600 mb-6">
                    Create a free account and start fixing up to 3 pages per week — no credit card required!
                  </p>
                  <Button asChild size="lg">
                    <a href="/auth">Get Started Free</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Download Result */}
          {result && (
            <Card className="animate-bounce-in glass-effect">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <span>PDF Processed Successfully!</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {result.pageCount} pages • {(result.fileSize / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <div className="flex space-x-2">
                      <Badge variant="success">Processed</Badge>
                      <Badge variant="success">Compressed</Badge>
                      <Badge variant="success">Optimized</Badge>
                    </div>
                  </div>
                  <Button asChild size="lg" className="shadow-lg">
                    <a href={result.downloadUrl} download>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Free Tier Notice */}
          <div className="text-center mt-16">
            <Card className="inline-block bg-gradient-to-r from-primary-500 to-primary-600 text-white border-0">
              <CardContent className="p-6">
                <p className="font-medium">
                  Free: 3 pages weekly • 
                  <Button variant="link" asChild className="text-white hover:text-primary-100 p-0 ml-2 font-semibold">
                    <a href="/pricing" className="inline-flex items-center">
                      Upgrade for unlimited processing
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </a>
                  </Button>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

// Force client-side rendering to avoid build issues with Supabase
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};