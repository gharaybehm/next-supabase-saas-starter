import Stripe from 'stripe'

// Constructed on first use, not at import. Next's "collect page data" build
// step imports every route module, including the webhook; a client built at
// import would make `next build` need STRIPE_SECRET_KEY, and passing it as a
// Docker build argument would bake a live secret into an image layer.
let client: Stripe | null = null

function getStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error(
        'Missing STRIPE_SECRET_KEY. Add it to .env.local (Stripe dashboard → Developers → API keys).'
      )
    }
    // No explicit apiVersion: the SDK's pinned default stays correct across upgrades.
    client = new Stripe(secretKey)
  }
  return client
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_TENANT_SEAT)
}

// Proxy so call sites read `stripe.checkout.sessions.create(...)`; only the
// moment of construction moves.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})
