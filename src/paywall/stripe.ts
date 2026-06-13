import { loadStripe } from '@stripe/stripe-js';

// We use Payment Links for headless client-side checkout
export const STRIPE_PRO_LINK = import.meta.env.VITE_STRIPE_PRO_PAYMENT_LINK || '';
export const STRIPE_INDUSTRIAL_LINK = import.meta.env.VITE_STRIPE_INDUSTRIAL_PAYMENT_LINK || '';

export async function redirectToCheckout(tier: 'professional' | 'industrial') {
  const link = tier === 'professional' ? STRIPE_PRO_LINK : STRIPE_INDUSTRIAL_LINK;
  if (!link) {
    alert(`Checkout failed: Stripe Payment Link for ${tier} is not configured.`);
    return;
  }
  
  // In a real app with Payment Links, we can just redirect directly:
  window.location.href = link;
}
