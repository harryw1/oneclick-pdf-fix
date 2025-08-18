import { NextApiRequest, NextApiResponse } from 'next';
import { createCheckoutSession, createCustomerPortalSession } from '@/utils/stripe';
import { createClient } from '@supabase/supabase-js';
import { subscriptionRateLimit, checkRateLimit } from '@/utils/rate-limit';
import { setSecurityHeaders } from '@/utils/security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // SECURITY: Set security headers and CORS
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // SECURITY: Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const identifier = Array.isArray(clientIP) ? clientIP[0] : clientIP;
  
  const rateLimitResult = await checkRateLimit(subscriptionRateLimit, identifier, 3, 60000);
  
  if (!rateLimitResult.success) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Too many subscription requests. Please try again later.',
      resetTime: rateLimitResult.reset
    });
  }
  // Get current user from auth token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  // Get user profile with authenticated client
  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: initialProfile, error: profileError } = await userSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Create profile if it doesn't exist (like in process.ts)
  let profile = initialProfile;
  if (profileError || !profile) {
    console.log('Profile not found for user:', user.id, 'Creating new profile...');
    
    const { data: newProfile, error: createError } = await userSupabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        plan: 'free',
        usage_this_week: 0,
        total_pages_processed: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create profile:', createError);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }
    
    profile = newProfile;
  }

  if (req.method === 'POST') {
    try {
      const { action } = req.body;

      if (action === 'create_checkout') {
        const { planType } = req.body;
        console.log('Checkout request:', { userId: user.id, planType });
        
        if (!planType || !['pro_monthly', 'pro_annual'].includes(planType)) {
          console.error('Invalid plan type:', planType);
          return res.status(400).json({ error: 'Valid plan type required' });
        }
        
        // Create Stripe checkout session
        console.log('Creating checkout session for plan:', planType);
        const session = await createCheckoutSession(user.id, user.email!, planType);
        console.log('Checkout session created:', { id: session.id, url: session.url });
        res.status(200).json({ sessionId: session.id, url: session.url });
      } else if (action === 'create_portal') {
        // Create customer portal session
        if (!profile.stripe_customer_id) {
          return res.status(400).json({ error: 'No active subscription found' });
        }
        
        const session = await createCustomerPortalSession(profile.stripe_customer_id);
        res.status(200).json({ url: session.url });
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      // SECURITY: Log detailed errors server-side, return generic message to client
      console.error('[SUBSCRIPTION ERROR]', {
        userId: user?.id,
        action: req.body?.action,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ error: 'Request processing failed' });
    }
  } else if (req.method === 'GET') {
    // Get subscription status
    try {
      res.status(200).json({ 
        plan: profile.plan,
        usage_this_week: profile.usage_this_week,
        total_pages_processed: profile.total_pages_processed,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id
      });
    } catch (error) {
      console.error('Subscription status error:', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}