'use client';

import { useStore } from '@/lib/state/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';

export function OnboardingChecklist() {
  const { onboardingCompleted, onboardingChecklist, onboardingProgress, completeChecklistItem } =
    useStore();

  if (onboardingCompleted) {
    return null;
  }

  return (
    <Card className="p-6 mb-6 border-blue-200 bg-blue-50">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Supply-Link! 🚀</h2>
        <p className="text-sm text-gray-600 mb-4">
          Complete these steps to get started with supply chain tracking.
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${onboardingProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">{onboardingProgress}% complete</p>
      </div>

      <div className="space-y-3">
        {onboardingChecklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/50 transition-colors"
          >
            <button
              onClick={() => completeChecklistItem(item.id)}
              className="mt-1 flex-shrink-0 focus:outline-none"
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  item.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}
              >
                {item.title}
                {item.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              <p className="text-xs text-gray-600">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">Required steps:</span> Complete all items marked with an
          asterisk (*) to finish onboarding.
        </p>
      </div>
    </Card>
  );
}
