import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import { toAppUser, type AppUser } from '@/types/app';
import { checkEmailVerification } from '@/utils/session';
import { getAuthRedirectUrl } from '@/utils/config';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth');
        return;
      }
      
      setUser(toAppUser(user));
      
      // Check if already verified
      const { verified } = await checkEmailVerification();
      if (verified) {
        router.push('/dashboard');
      }
    };
    
    checkUser();
  }, [router]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/auth/confirm'),
        },
      });
      
      if (error) throw error;
      
      setMessage('Verification email sent! Please check your inbox and spam folder.');
      setMessageType('success');
    } catch (error: unknown) {
      console.error('Resend verification error:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to resend verification email');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    setMessage('');
    
    try {
      const { verified } = await checkEmailVerification();
      
      if (verified) {
        setMessage('Email verified! Redirecting to dashboard...');
        setMessageType('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setMessage('Email not yet verified. Please check your inbox and click the verification link.');
        setMessageType('info');
      }
    } catch (_error) {
      setMessage('Error checking verification status. Please try again.');
      setMessageType('error');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <Layout 
      title="Verify Email - OneClick PDF Fixer"
      description="Verify your email address to continue"
      showAuth={false}
    >
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mail className="h-12 w-12 text-primary-500" />
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div>
              <p className="text-gray-600 mb-2">
                We&apos;ve sent a verification email to:
              </p>
              <p className="font-semibold text-gray-900">
                {user.email}
              </p>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Please check your inbox and click the verification link to activate your account.
              </p>
              
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <AlertCircle className="h-4 w-4" />
                <span>Don&apos;t forget to check your spam folder!</span>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-md text-sm ${
                messageType === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : messageType === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={handleCheckVerification} 
                disabled={checkingVerification}
                className="w-full"
                variant="outline"
              >
                {checkingVerification ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Check Verification Status
              </Button>
              
              <Button 
                onClick={handleResendVerification} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Resend Verification Email
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <p className="text-sm text-gray-500">
                Wrong email address?
              </p>
              <Button 
                onClick={handleSignOut}
                variant="ghost"
                className="text-primary-600 hover:text-primary-800"
              >
                Sign out and try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}