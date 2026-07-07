import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY not configured.');
  }

  stripeClient = new Stripe(apiKey);
  return stripeClient;
}

export const GRACE_PERIOD_DAYS = 7;
