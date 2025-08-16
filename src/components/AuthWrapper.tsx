'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, UserPlus } from 'lucide-react';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function AuthWrapper({ children, requireAuth = false }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Get user error:', error);
        }
        setUser(user);
      } catch (error) {
        console.error('Failed to get user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_IN') {
          setMessage('Successfully signed in!');
          setTimeout(() => setMessage(''), 3000);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (email: string, password: string) => {
    setAuthLoading(true);
    setMessage('');
    
    try {
      const supabase = createClient();
      
      if (isSignUp) {
        console.log('Attempting to sign up user:', email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        
        console.log('SignUp response:', { data, error });
        
        if (error) throw error;
        
        if (data.user && !data.session) {
          console.log('User created but needs email confirmation');
          setMessage('Account created! Please check your email to confirm your account.');
        } else if (data.session) {
          console.log('User created and signed in immediately');
          setMessage('Account created and signed in successfully!');
        } else {
          console.log('Unexpected signup result:', data);
          setMessage('Account creation completed. Please try signing in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) throw error;
        
        if (data.session) {
          setMessage('Successfully signed in!');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setMessage(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {isSignUp ? <UserPlus className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
            
            {message && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                message.includes('error') || message.includes('failed') || message.includes('invalid') || message.includes('incorrect')
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}
            
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsTransitioning(true);
                  setMessage('');
                  setTimeout(() => {
                    setIsSignUp(!isSignUp);
                    setIsTransitioning(false);
                  }, 150);
                }}
                disabled={authLoading || isTransitioning}
                className="text-sm text-primary-600 hover:text-primary-800 transition-all duration-150 disabled:opacity-50"
              >
                {isTransitioning ? 'Switching...' : (isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {children}
      {user && (
        <div className="fixed bottom-4 right-4">
          <Button variant="outline" onClick={handleSignOut} size="sm">
            Sign Out
          </Button>
        </div>
      )}
    </>
  );
}