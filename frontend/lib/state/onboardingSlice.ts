import { StateCreator } from 'zustand';
import type { OnboardingSlice, OnboardingChecklistItem } from './types';

const DEFAULT_CHECKLIST: OnboardingChecklistItem[] = [
  {
    id: 'wallet-setup',
    title: 'Set up Freighter Wallet',
    description: 'Install and configure the Freighter wallet extension',
    completed: false,
    required: true,
  },
  {
    id: 'fund-account',
    title: 'Fund Your Account',
    description: 'Add XLM to your wallet for transaction fees',
    completed: false,
    required: true,
  },
  {
    id: 'register-product',
    title: 'Register Your First Product',
    description: 'Create and register a product on the blockchain',
    completed: false,
    required: true,
  },
  {
    id: 'add-event',
    title: 'Add a Tracking Event',
    description: 'Record a supply chain event for your product',
    completed: false,
    required: true,
  },
  {
    id: 'authorize-actor',
    title: 'Authorize Supply Chain Actors',
    description: 'Grant permissions to other participants',
    completed: false,
    required: false,
  },
  {
    id: 'generate-qr',
    title: 'Generate QR Code',
    description: 'Create a QR code for product verification',
    completed: false,
    required: false,
  },
];

export const createOnboardingSlice: StateCreator<OnboardingSlice> = (set) => ({
  onboardingCompleted: false,
  onboardingChecklist: DEFAULT_CHECKLIST,
  onboardingProgress: 0,

  setOnboardingCompleted: (completed: boolean) => set({ onboardingCompleted: completed }),

  setOnboardingChecklist: (items: OnboardingChecklistItem[]) => {
    const completed = items.every((item) => !item.required || item.completed);
    const progress = Math.round((items.filter((i) => i.completed).length / items.length) * 100);
    set({
      onboardingChecklist: items,
      onboardingCompleted: completed,
      onboardingProgress: progress,
    });
  },

  completeChecklistItem: (itemId: string) =>
    set((state) => {
      const updated = state.onboardingChecklist.map((item) =>
        item.id === itemId ? { ...item, completed: true } : item,
      );
      const completed = updated.every((item) => !item.required || item.completed);
      const progress = Math.round(
        (updated.filter((i) => i.completed).length / updated.length) * 100,
      );
      return {
        onboardingChecklist: updated,
        onboardingCompleted: completed,
        onboardingProgress: progress,
      };
    }),

  resetOnboarding: () =>
    set({
      onboardingCompleted: false,
      onboardingChecklist: DEFAULT_CHECKLIST,
      onboardingProgress: 0,
    }),
});
