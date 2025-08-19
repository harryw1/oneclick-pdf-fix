import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setIsValidSession(false);
          setMessage('Your session has expired. Please request a new password reset.');
          setMessageType('error');
          return;
        }
        
        setIsValidSession(true);
      } catch (error) {
        console.error('Session check error:', error);
        setIsValidSession(false);
        setMessage('Unable to verify your session. Please request a new password reset.');
        setMessageType('error');
      }
    };
    
    checkSession();
  }, []);

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    return { 
      score: strength, 
      label: strength < 2 ? 'Weak' : strength < 4 ? 'Fair' : strength < 6 ? 'Good' : 'Strong',
      color: strength < 2 ? 'text-red-600' : strength < 4 ? 'text-yellow-600' : strength < 6 ? 'text-blue-600' : 'text-green-600'
    };
  };

  const passwordStrength = getPasswordStrength(password);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }
    
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('info');
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      setMessage('🎉 Password updated successfully! Redirecting to your dashboard...');
      setMessageType('success');
      
      // Redirect to dashboard after successful update
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Password update error:', error);
      
      // Handle specific error messages with user-friendly text
      let errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      
      if (error instanceof Error) {
        if (error.message.includes('same as the old password')) {
          errorMessage = 'Your new password must be different from your current password.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('weak password')) {
          errorMessage = 'Please choose a stronger password with a mix of letters, numbers, and symbols.';
        }
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <Layout 
        title="Update Password - OneClick PDF Fixer"
        description="Set your new password"
        showAuth={false}
      >
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-gray-600">Verifying your session...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isValidSession === false) {
    return (
      <Layout 
        title="Update Password - OneClick PDF Fixer"
        description="Set your new password"
        showAuth={false}
      >
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2 text-red-600">
                <Key className="h-6 w-6" />
                <span>Session Expired</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-6">
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-md text-sm">
                  {message}
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href="/auth">Request New Password Reset</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Update Password - OneClick PDF Fixer"
      description="Set your new password"
      showAuth={false}
    >
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              <Key className="h-6 w-6" />
              <span>Set New Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter new password"
                />
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Password strength:</span>
                      <span className={passwordStrength.color}>{passwordStrength.label}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          passwordStrength.score < 2 ? 'bg-red-500' : 
                          passwordStrength.score < 4 ? 'bg-yellow-500' : 
                          passwordStrength.score < 6 ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Requirements: 6+ characters, uppercase, lowercase, numbers, symbols</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    confirmPassword.length > 0 
                      ? password === confirmPassword 
                        ? 'border-green-300 focus:ring-green-500' 
                        : 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-primary-500'
                  }`}
                  placeholder="Confirm new password"
                />
                {confirmPassword.length > 0 && (
                  <div className={`mt-1 text-xs ${
                    password === confirmPassword ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </div>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Update Password
              </Button>
            </form>
            
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
            
            <div className="mt-6 text-center">
              <Link 
                href="/auth" 
                className="text-sm text-primary-600 hover:text-primary-800 transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}