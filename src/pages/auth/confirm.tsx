import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import Head from 'next/head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { token_hash, type, next } = router.query;
        
        if (!token_hash || !type) {
          setStatus('error');
          setMessage('Invalid confirmation link. Please request a new one.');
          return;
        }

        const supabase = createClient();
        
        // Handle different auth callback types
        switch (type) {
          case 'email':
            await handleEmailConfirmation(supabase, token_hash as string);
            break;
          case 'recovery':
            await handlePasswordReset(supabase, token_hash as string);
            break;
          case 'signup':
            await handleSignupConfirmation(supabase, token_hash as string);
            break;
          case 'magiclink':
            await handleMagicLink(supabase, token_hash as string);
            break;
          default:
            throw new Error(`Unknown auth type: ${type}`);
        }
        
        // Redirect to intended destination or dashboard
        const redirectUrl = (next as string) || '/dashboard';
        setTimeout(() => {
          router.push(redirectUrl);
        }, 2000);
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed. Please try again.');
      }
    };

    // Only run when router is ready and we have query params
    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router.isReady, router.query]);

  const handleEmailConfirmation = async (supabase: any, tokenHash: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email'
    });
    
    if (error) throw error;
    
    setStatus('success');
    setMessage('Email confirmed successfully! Redirecting to your dashboard...');
  };

  const handlePasswordReset = async (supabase: any, tokenHash: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery'
    });
    
    if (error) throw error;
    
    setStatus('success');
    setMessage('Password reset confirmed! You can now set a new password.');
    
    // Redirect to password update page after a brief delay
    setTimeout(() => {
      router.push('/auth/update-password');
    }, 2000);
  };

  const handleSignupConfirmation = async (supabase: any, tokenHash: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'signup'
    });
    
    if (error) throw error;
    
    setStatus('success');
    setMessage('Account confirmed successfully! Redirecting to your dashboard...');
  };

  const handleMagicLink = async (supabase: any, tokenHash: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink'
    });
    
    if (error) throw error;
    
    setStatus('success');
    setMessage('Magic link confirmed! Redirecting to your dashboard...');
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Confirming...';
      case 'success':
        return 'Success!';
      case 'error':
        return 'Error';
      default:
        return 'Processing...';
    }
  };

  return (
    <>
      <Head>
        <title>Confirming - OneClick PDF Fixer</title>
        <meta name="description" content="Confirming your authentication" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getIcon()}
            </div>
            <CardTitle className="text-2xl">{getTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">{message}</p>
            
            {status === 'error' && (
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <a href="/auth">Try Again</a>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <a href="/">Back to Homepage</a>
                </Button>
              </div>
            )}
            
            {status === 'loading' && (
              <p className="text-sm text-gray-500">
                Please wait while we process your request...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}