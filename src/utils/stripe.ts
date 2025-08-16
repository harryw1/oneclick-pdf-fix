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
    priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
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
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
    metadata: {
      userId,
    },
  });

  return session;
}

export async function createCustomerPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  });

  return session;
}