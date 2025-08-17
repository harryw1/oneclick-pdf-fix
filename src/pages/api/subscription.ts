import { NextApiRequest, NextApiResponse } from 'next';
import stripe, { createCheckoutSession, createCustomerPortalSession } from '@/utils/stripe';
import { createClient } from '@supabase/supabase-js';

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

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  if (req.method === 'POST') {
    try {
      const { action } = req.body;

      if (action === 'create_checkout') {
        const { planType } = req.body;
        if (!planType || !['pro_monthly', 'pro_annual'].includes(planType)) {
          return res.status(400).json({ error: 'Valid plan type required' });
        }
        
        // Create Stripe checkout session
        const session = await createCheckoutSession(user.id, user.email!, planType);
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
      console.error('Stripe error:', error);
      res.status(500).json({ error: 'Failed to process request' });
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