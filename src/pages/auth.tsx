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
      
      // Mark this as a password reset flow
      localStorage.setItem('auth-flow-type', 'password-reset');
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl('/auth/confirm'),
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

  return (
    <Layout 
      title={`${showPasswordReset ? 'Reset Password' : isSignUp ? 'Sign Up' : 'Sign In'} - OneClick PDF Fixer`}
      description="Access your OneClick PDF Fixer account"
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