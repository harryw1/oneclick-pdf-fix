import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
        
        // Check for PKCE code parameter (modern Supabase auth flow)
        const code = router.query.code || urlParams.get('code');
        const next = router.query.next || urlParams.get('next');
        
        // Legacy parameters for backwards compatibility
        const token_hash = router.query.token_hash || urlParams.get('token_hash') || hashParams.get('access_token');
        const type = router.query.type || urlParams.get('type') || hashParams.get('type');
        
        // Log everything for debugging
        console.log('=== Auth Callback Debug ===');
        console.log('URL:', window.location.href);
        console.log('Router query:', router.query);
        console.log('URL search params:', Object.fromEntries(urlParams.entries()));
        console.log('Hash params:', Object.fromEntries(hashParams.entries()));
        console.log('Extracted params:', { code, token_hash, type, next });
        
        const supabase = createClient();
        
        // PKCE flow - use auth state change listener
        if (code) {
          console.log('Detected PKCE code, setting up auth state listener...');
          
          // Set up a one-time auth state change listener
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log('Auth state change:', event, session);
              
              if (event === 'PASSWORD_RECOVERY' && session) {
                console.log('Password recovery flow detected:', session);
                setStatus('success');
                setMessage('Password reset confirmed! You can now set a new password.');
                
                // Unsubscribe from the listener
                subscription.unsubscribe();
                
                setTimeout(() => {
                  router.push('/auth/update-password');
                }, 2000);
              } else if (event === 'SIGNED_IN' && session) {
                console.log('User signed in via PKCE flow (magic link):', session);
                setStatus('success');
                setMessage('Authentication successful! Redirecting to your dashboard...');
                
                // Unsubscribe from the listener
                subscription.unsubscribe();
                
                const redirectUrl = (next as string) || '/dashboard';
                setTimeout(() => {
                  router.push(redirectUrl);
                }, 2000);
              } else if (event === 'SIGNED_OUT' || !session) {
                console.log('Auth state change but no session');
              }
            }
          );
          
          // Also try to get the current session immediately
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Session already exists:', session);
            setStatus('success');
            subscription.unsubscribe();
            
            // For immediate sessions, we need to check if this was a password recovery
            // by looking at localStorage as fallback (since PASSWORD_RECOVERY event may have already fired)
            const authFlowType = localStorage.getItem('auth-flow-type');
            localStorage.removeItem('auth-flow-type');
            
            if (authFlowType === 'password-reset') {
              setMessage('Password reset confirmed! You can now set a new password.');
              setTimeout(() => {
                router.push('/auth/update-password');
              }, 2000);
            } else {
              setMessage('Authentication successful! Redirecting to your dashboard...');
              const redirectUrl = (next as string) || '/dashboard';
              setTimeout(() => {
                router.push(redirectUrl);
              }, 2000);
            }
          } else {
            // Set a timeout to show error if no auth state change occurs
            setTimeout(() => {
              subscription.unsubscribe();
              if (status === 'loading') {
                setStatus('error');
                setMessage('Authentication timed out. Please try again.');
              }
            }, 10000); // 10 second timeout
          }
          
          return;
        }
        
        // Legacy approach: Direct tokens in hash
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
        
        // Legacy approach: OTP verification
        if (token_hash && type) {
          console.log('Attempting legacy OTP verification...');
          const validEmailTypes = ['signup', 'recovery', 'invite', 'magiclink', 'email_change'] as const;
          const emailType = validEmailTypes.includes(type as typeof validEmailTypes[number]) ? type as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' : 'signup';
          
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token_hash as string,
            type: emailType
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
          return;
        }
        
        // No valid auth parameters found
        setStatus('error');
        setMessage('Invalid confirmation link. Please request a new one.');
        
      } catch (error: unknown) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
      }
    };

    // Only run when router is ready
    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router, status]);


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
    <Layout 
      title="Confirming - OneClick PDF Fixer"
      description="Confirming your authentication"
      showAuth={false}
    >
      <div className="flex items-center justify-center min-h-[80vh] p-4">
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
                  <Link href="/auth">Try Again</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">Back to Homepage</Link>
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
    </Layout>
  );
}