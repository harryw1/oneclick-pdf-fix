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
        
        // Extract auth parameters from URL
        
        const supabase = createClient();
        
        // PKCE flow - use auth state change listener
        if (code) {
          // PKCE flow detected - set up auth state listener
          
          // Check URL parameters for type hints
          const typeParam = router.query.type || urlParams.get('type');
          const isPasswordRecovery = typeParam === 'recovery';
          
          // Store the flow type in sessionStorage (more reliable than localStorage)
          const authFlowType = localStorage.getItem('auth-flow-type') || sessionStorage.getItem('auth-flow-type');
          if (isPasswordRecovery || authFlowType === 'password-reset') {
            sessionStorage.setItem('auth-flow-type', 'password-reset');
          }
          
          // Set up a one-time auth state change listener
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              // Handle auth state change
              
              if (event === 'PASSWORD_RECOVERY' && session) {
                // Password recovery flow detected
                setStatus('success');
                setMessage('Password reset confirmed! You can now set a new password.');
                
                // Clear flow type indicators
                localStorage.removeItem('auth-flow-type');
                sessionStorage.removeItem('auth-flow-type');
                
                // Unsubscribe from the listener
                subscription.unsubscribe();
                
                setTimeout(() => {
                  router.push('/auth/update-password');
                }, 2000);
              } else if (event === 'SIGNED_IN' && session) {
                // User signed in via PKCE flow
                
                // Check if this was a password recovery flow
                const storedFlowType = sessionStorage.getItem('auth-flow-type') || localStorage.getItem('auth-flow-type');
                
                if (storedFlowType === 'password-reset') {
                  // Password recovery flow detected from stored state
                  setStatus('success');
                  setMessage('Password reset confirmed! You can now set a new password.');
                  
                  // Clear flow type indicators
                  localStorage.removeItem('auth-flow-type');
                  sessionStorage.removeItem('auth-flow-type');
                  
                  // Unsubscribe from the listener
                  subscription.unsubscribe();
                  
                  setTimeout(() => {
                    router.push('/auth/update-password');
                  }, 2000);
                } else {
                  // Regular sign-in flow
                  setStatus('success');
                  
                  // Check if this is a first-time email confirmation
                  const isFirstTimeConfirmation = session.user.email_confirmed_at && 
                    new Date(session.user.email_confirmed_at).getTime() > (Date.now() - 30000); // Within last 30 seconds
                  
                  if (isFirstTimeConfirmation) {
                    setMessage('🎉 Welcome! Your email has been confirmed successfully. Redirecting to your dashboard...');
                  } else {
                    setMessage('Authentication successful! Redirecting to your dashboard...');
                  }
                  
                  // Unsubscribe from the listener
                  subscription.unsubscribe();
                  
                  const redirectUrl = (next as string) || '/dashboard';
                  setTimeout(() => {
                    router.push(redirectUrl);
                  }, 2000);
                }
              } else if (event === 'SIGNED_OUT' || !session) {
                // Auth state changed but no session present
              }
            }
          );
          
          // Also try to get the current session immediately
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Session already exists
            setStatus('success');
            subscription.unsubscribe();
            
            // For immediate sessions, we need to check if this was a password recovery
            const storedFlowType = sessionStorage.getItem('auth-flow-type') || localStorage.getItem('auth-flow-type');
            
            if (storedFlowType === 'password-reset' || isPasswordRecovery) {
              setMessage('Password reset confirmed! You can now set a new password.');
              
              // Clear flow type indicators
              localStorage.removeItem('auth-flow-type');
              sessionStorage.removeItem('auth-flow-type');
              
              setTimeout(() => {
                router.push('/auth/update-password');
              }, 2000);
            } else {
              // Check if this is a first-time email confirmation
              const isFirstTimeConfirmation = session.user.email_confirmed_at && 
                new Date(session.user.email_confirmed_at).getTime() > (Date.now() - 30000); // Within last 30 seconds
              
              if (isFirstTimeConfirmation) {
                setMessage('🎉 Welcome! Your email has been confirmed successfully. Redirecting to your dashboard...');
              } else {
                setMessage('Authentication successful! Redirecting to your dashboard...');
              }
              
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
          // Tokens detected in URL hash
          
          const { error } = await supabase.auth.setSession({
            access_token: hashParams.get('access_token')!,
            refresh_token: hashParams.get('refresh_token')!
          });
          
          if (error) {
            // Session setting failed
            throw error;
          }
          
          // Session set successfully
          setStatus('success');
          setMessage('Authentication successful! Redirecting to your dashboard...');
          
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
          return;
        }
        
        // Legacy approach: OTP verification
        if (token_hash && type) {
          // Attempting legacy OTP verification
          const validEmailTypes = ['signup', 'recovery', 'invite', 'magiclink', 'email_change'] as const;
          const emailType = validEmailTypes.includes(type as typeof validEmailTypes[number]) ? type as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' : 'signup';
          
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token_hash as string,
            type: emailType
          });
          
          if (error) {
            // OTP verification failed
            throw error;
          }
          
          // OTP verification successful
          
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
        // Auth callback error occurred
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