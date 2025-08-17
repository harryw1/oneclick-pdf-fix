import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseApiKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseApiKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseApiKey);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Always verify webhook signatures - never bypass in any environment
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    console.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing webhook signature' });
  }

  if (!endpointSecret) {
    console.error('Missing webhook endpoint secret');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  let event: Stripe.Event;
  let rawBody: string;

  try {
    // Get raw body for signature verification
    const chunks: Buffer[] = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    rawBody = Buffer.concat(chunks).toString();
    
    // SECURITY: Always verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  console.log('Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription') {
          const userId = session.metadata?.userId;
          const planType = session.metadata?.planType || 'pro_monthly';
          
          if (userId) {
            // Update user to appropriate pro plan
            await supabase
              .from('profiles')
              .update({
                plan: planType,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);

            console.log(`User ${userId} upgraded to ${planType} plan`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        if (subscription.status === 'active') {
          // Keep existing pro plan type, just ensure it's active
          console.log(`Subscription ${subscription.id} is active`);
        } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          // Downgrade to free plan
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscription.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Downgrade to free plan
        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        console.log(`Subscription ${subscription.id} canceled, user downgraded to free`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.subscription) {
          // Handle failed payment - could send email notification
          console.log(`Payment failed for subscription ${invoice.subscription}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
}