import { supabase, getUserSession, signOut } from './supabase';
import { PaywallGate, SubscriptionTier, triggerUpgrade } from '../paywall/gate';

export async function initModals() {
  const modalAuth = document.getElementById('modal-auth');
  const modalPricing = document.getElementById('modal-pricing');
  
  const btnCloseAuth = document.getElementById('btn-close-auth');
  const btnClosePricing = document.getElementById('btn-close-pricing');

  btnCloseAuth?.addEventListener('click', () => modalAuth?.classList.remove('active'));
  btnClosePricing?.addEventListener('click', () => modalPricing?.classList.remove('active'));

  const btnOpenAuth = document.getElementById('btn-open-auth');
  const btnOpenPricing = document.getElementById('btn-open-pricing');

  btnOpenAuth?.addEventListener('click', showAuthModal);
  btnOpenPricing?.addEventListener('click', showPricingModal);

  // Close on background click
  [modalAuth, modalPricing].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Auth Submit logic
  const authEmail = document.getElementById('auth-email') as HTMLInputElement;
  const authPassword = document.getElementById('auth-password') as HTMLInputElement;
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  
  let isSignUpMode = false;
  const btnAuthToggle = document.getElementById('btn-auth-toggle');
  
  btnAuthToggle?.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    if (btnAuthToggle) btnAuthToggle.textContent = isSignUpMode ? "Already have an account? Log in" : "Don't have an account? Sign up";
    if (btnAuthSubmit) btnAuthSubmit.textContent = isSignUpMode ? "Sign Up" : "Log In";
  });

  btnAuthSubmit?.addEventListener('click', async () => {
    const email = authEmail?.value;
    const password = authPassword?.value;
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }
    
    if (btnAuthSubmit) btnAuthSubmit.textContent = "Processing...";
    
    if (isSignUpMode) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(`Sign up failed: ${error.message}`);
      else alert("Sign up successful! Please check your email to verify (if enabled), or login.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(`Login failed: ${error.message}`);
      else window.location.reload();
    }
    
    if (btnAuthSubmit) btnAuthSubmit.textContent = isSignUpMode ? "Sign Up" : "Log In";
  });

  // Initialize Auth State
  const { session } = await getUserSession();
  
  const btnAccountToggle = document.getElementById('btn-account-toggle');
  const accountDropdown = document.getElementById('account-dropdown');
  const btnSignOut = document.getElementById('btn-sign-out');
  const accountEmail = document.getElementById('account-email');
  const btnManageBilling = document.getElementById('btn-manage-billing');
  
  const btnTierPro = document.getElementById('btn-tier-pro');
  const btnTierIndustrial = document.getElementById('btn-tier-industrial');
  
  btnTierPro?.addEventListener('click', () => {
    triggerUpgrade('professional');
  });
  
  btnTierIndustrial?.addEventListener('click', () => {
    triggerUpgrade('industrial');
  });

  if (session) {
    if (btnOpenAuth) btnOpenAuth.style.display = 'none';
    const accountDashboard = document.getElementById('header-account-dashboard');
    if (accountDashboard) accountDashboard.style.display = 'block';
    
    if (accountEmail) accountEmail.textContent = session.user.email || '';
    
    // Simulate tier fetch (normally fetched from user_metadata or db)
    PaywallGate.setUserTier(SubscriptionTier.FREE);
    
    btnAccountToggle?.addEventListener('click', () => {
      if (accountDropdown) {
        accountDropdown.style.display = accountDropdown.style.display === 'none' ? 'block' : 'none';
      }
    });
    
    btnSignOut?.addEventListener('click', () => {
      signOut();
    });
    
    btnManageBilling?.addEventListener('click', () => {
      // In a real app, redirect to Stripe Billing Portal
      alert("Stripe Customer Portal will open here to manage subscription.");
    });
  }
}

export function showAuthModal() {
  document.getElementById('modal-auth')?.classList.add('active');
}

export function showPricingModal() {
  document.getElementById('modal-pricing')?.classList.add('active');
}

(window as any).showAuthModal = showAuthModal;
(window as any).showPricingModal = showPricingModal;

export function isPremiumUser(): boolean {
  return PaywallGate.getUserTier() !== SubscriptionTier.FREE;
}
