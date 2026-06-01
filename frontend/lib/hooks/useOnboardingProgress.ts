import { useEffect } from 'react';
import { useStore } from '@/lib/state/store';

/**
 * Hook to automatically update onboarding checklist based on user actions.
 * Tracks wallet connection, product registration, and event creation.
 */
export function useOnboardingProgress() {
  const { walletAddress, products, events, completeChecklistItem, onboardingChecklist } =
    useStore();

  useEffect(() => {
    // Check wallet setup
    if (walletAddress && !onboardingChecklist.find((i) => i.id === 'wallet-setup')?.completed) {
      completeChecklistItem('wallet-setup');
    }
  }, [walletAddress, onboardingChecklist, completeChecklistItem]);

  useEffect(() => {
    // Check first product registration
    if (
      products.length > 0 &&
      !onboardingChecklist.find((i) => i.id === 'register-product')?.completed
    ) {
      completeChecklistItem('register-product');
    }
  }, [products, onboardingChecklist, completeChecklistItem]);

  useEffect(() => {
    // Check first event added
    if (events.length > 0 && !onboardingChecklist.find((i) => i.id === 'add-event')?.completed) {
      completeChecklistItem('add-event');
    }
  }, [events, onboardingChecklist, completeChecklistItem]);
}
