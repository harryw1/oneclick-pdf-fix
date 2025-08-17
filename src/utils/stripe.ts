import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default stripe;

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    pages_per_week: 5,
    max_file_size_mb: 10,
    features: ['5 pages per week', 'Basic PDF processing', 'Auto-rotation & compression', 'Instant download']
  },
  pro_monthly: {
    name: 'Pro Monthly',
    price: 9,
    priceId: 'price_1RwvVORVxTjhJx7KOaIiRhud',
    pages_per_month: 100,
    max_file_size_mb: 100,
    features: [
      '100 pages per month',
      'Advanced OCR & deskewing',
      'Document classification',
      '100MB file uploads',
      'Priority processing'
    ]
  },
  pro_annual: {
    name: 'Pro Annual',
    price: 90,
    priceId: 'price_1RwvWfRVxTjhJx7K2up31JMo',
    pages_per_month: 100,
    max_file_size_mb: 100,
    discount_months: 2,
    features: [
      '100 pages per month',
      'Advanced OCR & deskewing',
      'Document classification',
      '100MB file uploads',
      'Priority processing',
      '2 months free (16% discount)'
    ]
  }
};

export async function createCheckoutSession(userId: string, email: string, planType: 'pro_monthly' | 'pro_annual') {
  const plan = PLANS[planType];
  
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/pricing?canceled=true`,
    metadata: {
      userId,
      planType,
    },
    allow_promotion_codes: true,
  });

  return session;
}


export async function createCustomerPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/dashboard`,
  });

  return session;
}

export async function getSubscriptionStatus(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  return subscriptions.data[0] || null;
}