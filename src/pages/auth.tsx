import { useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import { getAuthRedirectUrl } from '@/utils/config';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, UserPlus, Mail, Key } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const router = useRouter();

  const handleAuth = async (email: string, password: string) => {
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.user && !data.session) {
          // User created but email not confirmed - redirect to verification page
          router.push('/auth/verify-email');
        } else if (data.session) {
          setMessage('Account created successfully!');
          setMessageType('success');
          router.push('/dashboard');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.session) {
          router.push('/dashboard');
        }
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      
      // Handle specific error types with friendly messages
      let errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      
      if (error instanceof Error && error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Hmm, that email and password combination doesn\'t look right. Please double-check and try again.';
      } else if (error instanceof Error && error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the verification link before signing in.';
        // If we have the email, redirect to verification page
        setTimeout(() => {
          router.push('/auth/verify-email');
        }, 2000);
      } else if (error instanceof Error && error.message?.includes('Too many requests')) {
        errorMessage = 'Whoa there! Too many attempts. Please take a short break and try again in a few minutes.';
      } else if (error instanceof Error && error.message?.includes('User already registered')) {
        errorMessage = 'Good news! You already have an account with this email. Try signing in instead.';
      } else if (error instanceof Error && error.message?.includes('Password should be at least')) {
        errorMessage = 'Your password needs to be at least 6 characters long for security.';
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      // Mark this as a password reset flow in both storages for reliability
      localStorage.setItem('auth-flow-type', 'password-reset');
      sessionStorage.setItem('auth-flow-type', 'password-reset');
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl('/auth/confirm?type=recovery'),
      });
      
      if (error) throw error;
      
      setMessage('Password reset email sent! Check your inbox (and spam folder just in case).');
      setMessageType('success');
      setShowPasswordReset(false);
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to send password reset email');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (email: string) => {
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      // Mark this as a magic link flow
      localStorage.setItem('auth-flow-type', 'magic-link');
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/auth/confirm'),
        },
      });
      
      if (error) throw error;
      
      setMessage('Magic link sent! Check your email for an instant sign-in link.');
      setMessageType('success');
    } catch (error: unknown) {
      console.error('Magic link error:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to send magic link');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async (email: string) => {
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/auth/confirm'),
        },
      });
      
      if (error) throw error;
      
      setMessage('Confirmation email resent! Please check your inbox.');
      setMessageType('success');
    } catch (error: unknown) {
      console.error('Resend confirmation error:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to resend confirmation email');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google') => {
    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectUrl('/auth/confirm'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) throw error;
      
      // OAuth redirect will happen automatically
    } catch (error: unknown) {
      console.error(`${provider} OAuth error:`, error);
      setMessage(error instanceof Error ? error.message : `Failed to sign in with ${provider}`);
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <Layout 
      title={`${showPasswordReset ? 'Reset Password' : isSignUp ? 'Sign Up' : 'Sign In'} - OneClick PDF Fixer`}
      description="Access your OneClick PDF Fixer account to process PDFs with AI-powered document repair and optimization tools."
      keywords="PDF fixer login, document processing account, sign up PDF tools, user account"
      showAuth={false}
    >
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {showPasswordReset ? (
                <><Key className="h-6 w-6" /><span>Reset Password</span></>
              ) : isSignUp ? (
                <><UserPlus className="h-6 w-6" /><span>Create Account</span></>
              ) : (
                <><LogIn className="h-6 w-6" /><span>Sign In</span></>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showPasswordReset ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get('email') as string;
                handlePasswordReset(email);
              }} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your email address"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Send Reset Email
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                handleAuth(email, password);
              }} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            )}
            
            {message && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                messageType === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : messageType === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {message}
                {message.includes('check your email to confirm') && (
                  <button
                    onClick={() => {
                      const email = (document.getElementById('email') as HTMLInputElement)?.value;
                      if (email) {
                        handleResendConfirmation(email);
                      }
                    }}
                    disabled={loading}
                    className="ml-2 text-primary-600 hover:text-primary-800 underline disabled:opacity-50"
                  >
                    Resend email
                  </button>
                )}
              </div>
            )}
            
            {/* OAuth Providers */}
            {!showPasswordReset && (
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    )}
                    <span className="ml-2">Continue with Google</span>
                  </Button>
                </div>
              </div>
            )}
            
            <div className="mt-4 space-y-2 text-center">
              {!showPasswordReset && !isSignUp && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPasswordReset(true)}
                    disabled={loading}
                    className="text-sm text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-50 block mx-auto"
                  >
                    Forgot your password?
                  </button>
                  <button
                    onClick={() => {
                      const email = (document.getElementById('email') as HTMLInputElement)?.value;
                      if (email) {
                        handleMagicLink(email);
                      } else {
                        setMessage('Please enter your email address first');
                        setMessageType('error');
                      }
                    }}
                    disabled={loading}
                    className="text-sm text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-50 flex items-center space-x-1 mx-auto"
                  >
                    <Mail className="h-3 w-3" />
                    <span>Send magic link instead</span>
                  </button>
                </div>
              )}
              
              {showPasswordReset ? (
                <button
                  onClick={() => {
                    setShowPasswordReset(false);
                    setMessage('');
                  }}
                  disabled={loading}
                  className="text-sm text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-50"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setMessage('');
                  }}
                  disabled={loading}
                  className="text-sm text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-50"
                >
                  {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                </button>
              )}
            </div>

            <div className="mt-6 text-center">
              <Link 
                href="/" 
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Back to homepage
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}