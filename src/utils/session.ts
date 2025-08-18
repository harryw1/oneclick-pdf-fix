import { createClient } from '@/utils/supabase/client';
import { toAppUser, type AppUser } from '@/types/app';

export interface SessionInfo {
  isAuthenticated: boolean;
  user: AppUser | null;
  expiresAt?: number;
  needsRefresh: boolean;
}

export async function getSessionInfo(): Promise<SessionInfo> {
  try {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session error:', error);
      return { isAuthenticated: false, user: null, needsRefresh: false };
    }
    
    if (!session) {
      return { isAuthenticated: false, user: null, needsRefresh: false };
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
    
    // If session expires in less than 5 minutes, mark as needing refresh
    const needsRefresh = timeUntilExpiry < 300;
    
    return {
      isAuthenticated: true,
      user: toAppUser(session.user),
      expiresAt,
      needsRefresh
    };
  } catch (error) {
    console.error('Session check error:', error);
    return { isAuthenticated: false, user: null, needsRefresh: false };
  }
}

export async function refreshSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error:', error);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('Session refresh error:', error);
    return false;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// Check if user account is verified
export async function checkEmailVerification(): Promise<{ verified: boolean; needsVerification: boolean }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { verified: false, needsVerification: false };
    }
    
    // Check if email is confirmed
    const emailConfirmed = user.email_confirmed_at !== null;
    
    return {
      verified: emailConfirmed,
      needsVerification: !emailConfirmed
    };
  } catch (error) {
    console.error('Email verification check error:', error);
    return { verified: false, needsVerification: false };
  }
}