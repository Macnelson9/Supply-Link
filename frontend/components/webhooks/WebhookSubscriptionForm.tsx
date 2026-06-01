'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type {
  WebhookSubscriptionResponse,
  WebhookEventType,
  ProductEventType,
} from '@/lib/webhooks/types';

interface WebhookSubscriptionFormProps {
  webhookId: string;
  subscription?: WebhookSubscriptionResponse;
  onSuccess?: (subscription: WebhookSubscriptionResponse) => void;
  onCancel?: () => void;
}

const WEBHOOK_EVENT_TYPES: WebhookEventType[] = ['TRACKING_EVENT_CREATED', 'PRODUCT_EVENT_CHANGED'];
const PRODUCT_EVENT_TYPES: ProductEventType[] = [
  'product_registered',
  'product_updated',
  'event_added',
  'actor_authorized',
  'actor_removed',
  'compliance_policy_updated',
];

export function WebhookSubscriptionForm({
  webhookId,
  subscription,
  onSuccess,
  onCancel,
}: WebhookSubscriptionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(subscription?.name ?? '');
  const [description, setDescription] = useState(subscription?.description ?? '');
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<WebhookEventType>>(
    new Set(subscription?.eventTypes ?? ['PRODUCT_EVENT_CHANGED']),
  );
  const [selectedProductEventTypes, setSelectedProductEventTypes] = useState<Set<ProductEventType>>(
    new Set(subscription?.productEventFilter?.types ?? []),
  );
  const [productIds, setProductIds] = useState(
    subscription?.productEventFilter?.productIds?.join(', ') ?? '',
  );
  const [maxRetries, setMaxRetries] = useState(subscription?.retryPolicy?.maxRetries ?? 5);
  const [backoffMs, setBackoffMs] = useState(subscription?.retryPolicy?.backoffMs ?? 1000);
  const [active, setActive] = useState(subscription?.active ?? true);

  const toggleEventType = (eventType: WebhookEventType) => {
    const newSet = new Set(selectedEventTypes);
    if (newSet.has(eventType)) {
      newSet.delete(eventType);
    } else {
      newSet.add(eventType);
    }
    setSelectedEventTypes(newSet);
  };

  const toggleProductEventType = (eventType: ProductEventType) => {
    const newSet = new Set(selectedProductEventTypes);
    if (newSet.has(eventType)) {
      newSet.delete(eventType);
    } else {
      newSet.add(eventType);
    }
    setSelectedProductEventTypes(newSet);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error('Subscription name is required');
      }

      if (selectedEventTypes.size === 0) {
        throw new Error('At least one event type must be selected');
      }

      const payload = {
        name,
        description: description || undefined,
        eventTypes: Array.from(selectedEventTypes),
        productEventFilter:
          selectedProductEventTypes.size > 0 || productIds.trim()
            ? {
                types:
                  selectedProductEventTypes.size > 0
                    ? Array.from(selectedProductEventTypes)
                    : undefined,
                productIds: productIds
                  .split(',')
                  .map((id) => id.trim())
                  .filter((id) => id),
              }
            : undefined,
        retryPolicy: {
          maxRetries,
          backoffMs,
        },
        active,
      };

      const method = subscription ? 'PATCH' : 'POST';
      const url = subscription
        ? `/api/v1/webhooks/${webhookId}/subscriptions/${subscription.id}`
        : `/api/v1/webhooks/${webhookId}/subscriptions`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      onSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]">
          Subscription Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Product Events to CRM"
          className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of this subscription"
          className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] h-20 resize-none"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Event Types *
        </label>
        <div className="space-y-2">
          {WEBHOOK_EVENT_TYPES.map((eventType) => (
            <label key={eventType} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedEventTypes.has(eventType)}
                onChange={() => toggleEventType(eventType)}
                disabled={loading}
                className="w-4 h-4"
              />
              <span className="ml-2 text-sm text-[var(--foreground)]">{eventType}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedEventTypes.has('PRODUCT_EVENT_CHANGED') && (
        <>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Product Event Types (leave empty for all)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {PRODUCT_EVENT_TYPES.map((eventType) => (
                <label key={eventType} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedProductEventTypes.has(eventType)}
                    onChange={() => toggleProductEventType(eventType)}
                    disabled={loading}
                    className="w-4 h-4"
                  />
                  <span className="ml-2 text-sm text-[var(--foreground)]">{eventType}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Product IDs (comma-separated, leave empty for all)
            </label>
            <input
              type="text"
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              placeholder="e.g., prod-123, prod-456"
              className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
              disabled={loading}
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)]">Max Retries</label>
          <input
            type="number"
            value={maxRetries}
            onChange={(e) =>
              setMaxRetries(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))
            }
            min="0"
            max="10"
            className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)]">Backoff (ms)</label>
          <input
            type="number"
            value={backoffMs}
            onChange={(e) =>
              setBackoffMs(Math.max(100, Math.min(60000, parseInt(e.target.value) || 1000)))
            }
            min="100"
            max="60000"
            className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]"
            disabled={loading}
          />
        </div>
      </div>

      <label className="flex items-center">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={loading}
          className="w-4 h-4"
        />
        <span className="ml-2 text-sm text-[var(--foreground)]">Active</span>
      </label>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : subscription ? 'Update' : 'Create'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
