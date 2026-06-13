export enum SubscriptionTier {
  FREE = "free",
  PROFESSIONAL = "professional",
  INDUSTRIAL = "industrial",
}

export class PaywallGate {
  private static currentUserTier: SubscriptionTier = SubscriptionTier.FREE;

  public static setUserTier(tier: SubscriptionTier) {
    this.currentUserTier = tier;
    console.log(`[VECTRONOMY PAYWALL] User tier set to ${tier}`);
  }

  public static getUserTier(): SubscriptionTier {
    return this.currentUserTier;
  }

  public static requires(tier: SubscriptionTier): boolean {
    const tiers = [SubscriptionTier.FREE, SubscriptionTier.PROFESSIONAL, SubscriptionTier.INDUSTRIAL];
    return tiers.indexOf(this.currentUserTier) >= tiers.indexOf(tier);
  }

  public static enforce(featureName: string, requiredTier: SubscriptionTier) {
    if (!this.requires(requiredTier)) {
      // Trigger the pricing modal to show up
      const pricingModal = document.getElementById('modal-pricing');
      if (pricingModal) pricingModal.classList.add('active');
      
      alert(`The ${featureName} feature requires a ${requiredTier.toUpperCase()} subscription.\nPlease upgrade your account to use this industrial tool.`);
      throw new Error(`Paywall Gate: ${featureName} requires ${requiredTier}`);
    }
  }
}

import { redirectToCheckout } from './stripe';
export function triggerUpgrade(tier: 'professional' | 'industrial') {
  redirectToCheckout(tier);
}
