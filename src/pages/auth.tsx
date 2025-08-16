import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, UserPlus, Mail, Key } from 'lucide-react';

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
          setMessage('Account created! Please check your email to confirm your account.');
          setMessageType('success');
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
    } catch (error: any) {
      console.error('Auth error:', error);
      setMessage(error.message || 'Authentication failed');
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
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      });
      
      if (error) throw error;
      
      setMessage('Password reset email sent! Please check your inbox.');
      setMessageType('success');
      setShowPasswordReset(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      setMessage(error.message || 'Failed to send password reset email');
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
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?type=magiclink`,
        },
      });
      
      if (error) throw error;
      
      setMessage('Magic link sent! Please check your email.');
      setMessageType('success');
    } catch (error: any) {
      console.error('Magic link error:', error);
      setMessage(error.message || 'Failed to send magic link');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {showPasswordReset ? 'Reset Password' : isSignUp ? 'Sign Up' : 'Sign In'} - OneClick PDF Fixer
        </title>
        <meta name="description" content="Sign in to your OneClick PDF Fixer account" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50 flex items-center justify-center p-4">
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
              <a 
                href="/" 
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Back to homepage
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}