import { NextApiRequest, NextApiResponse } from 'next';
import stripe, { createCheckoutSession } from '@/utils/stripe';
import { getCurrentUser } from '@/utils/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await createCheckoutSession(user.id, user.email);
      
      res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  } else if (req.method === 'GET') {
    // Get subscription status
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // TODO: Fetch subscription from database
      res.status(200).json({ 
        plan: user.plan,
        usage_this_week: user.usage_this_week
      });
    } catch (error) {
      console.error('Subscription status error:', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}