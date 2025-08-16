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
        // First, let's get URL parameters from both query and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Check both query params and router query
        let token_hash = router.query.token_hash || urlParams.get('token_hash') || hashParams.get('access_token');
        let type = router.query.type || urlParams.get('type') || hashParams.get('type');
        let next = router.query.next || urlParams.get('next');
        
        // Log everything for debugging
        console.log('=== Auth Callback Debug ===');
        console.log('URL:', window.location.href);
        console.log('Router query:', router.query);
        console.log('URL search params:', Object.fromEntries(urlParams.entries()));
        console.log('Hash params:', Object.fromEntries(hashParams.entries()));
        console.log('Extracted params:', { token_hash, type, next });
        
        const supabase = createClient();
        
        // If we have an access_token in the hash, this is likely from a magic link
        // Let's try to get the session directly
        if (hashParams.get('access_token') && hashParams.get('refresh_token')) {
          console.log('Detected tokens in hash, setting session...');
          
          const { data, error } = await supabase.auth.setSession({
            access_token: hashParams.get('access_token')!,
            refresh_token: hashParams.get('refresh_token')!
          });
          
          if (error) {
            console.error('Session setting error:', error);
            throw error;
          }
          
          console.log('Session set successfully:', data);
          setStatus('success');
          setMessage('Authentication successful! Redirecting to your dashboard...');
          
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
          return;
        }
        
        // Otherwise, try the OTP verification approach
        if (!token_hash || !type) {
          setStatus('error');
          setMessage('Invalid confirmation link. Please request a new one.');
          return;
        }

        console.log('Attempting OTP verification...');
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token_hash as string,
          type: type as any
        });
        
        if (error) {
          console.error('OTP verification error:', error);
          throw error;
        }
        
        console.log('OTP verification success:', data);
        
        // Handle success based on type
        switch (type) {
          case 'recovery':
            setStatus('success');
            setMessage('Password reset confirmed! You can now set a new password.');
            setTimeout(() => {
              router.push('/auth/update-password');
            }, 2000);
            break;
          default:
            setStatus('success');
            setMessage('Authentication successful! Redirecting to your dashboard...');
            const redirectUrl = (next as string) || '/dashboard';
            setTimeout(() => {
              router.push(redirectUrl);
            }, 2000);
        }
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed. Please try again.');
      }
    };

    // Only run when router is ready
    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router.isReady, router.query]);


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