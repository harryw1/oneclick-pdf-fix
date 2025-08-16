import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'placeholder';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  usage_this_week: number;
  created_at: string;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  return profile ? {
    id: user.id,
    email: user.email!,
    plan: profile.plan || 'free',
    usage_this_week: profile.usage_this_week || 0,
    created_at: profile.created_at
  } : null;
}

export async function signInWithEmail(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return await supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function updateUsage(userId: string, pagesProcessed: number) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      usage_this_week: pagesProcessed,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  return { data, error };
}