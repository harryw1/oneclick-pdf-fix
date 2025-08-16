import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default stripe;

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    pages_per_week: 10,
    features: ['Basic PDF processing', 'Auto-rotation & compression', 'Instant download']
  },
  pro: {
    name: 'Pro',
    price: 4,
    priceId: 'price_1RwlaQRVxTjhJx7K34kVkPf6',
    pages_per_week: Infinity,
    features: [
      'Unlimited pages',
      'Advanced OCR & deskewing', 
      '90-day document storage',
      'Priority processing',
      'Batch processing'
    ]
  }
};

export async function createCheckoutSession(userId: string, email: string) {
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    payment_method_types: ['card'],
    line_items: [
      {
        price: PLANS.pro.priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pricing?canceled=true`,
    metadata: {
      userId,
    },
    allow_promotion_codes: true,
  });

  return session;
}

export async function createCustomerPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
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