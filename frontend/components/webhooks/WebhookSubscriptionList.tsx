'use client';

import { useEffect, useState } from 'react';
import { Edit2, Trash2, Plus } from 'lucide-react';
import type { WebhookSubscriptionResponse } from '@/lib/webhooks/types';
import { WebhookSubscriptionForm } from './WebhookSubscriptionForm';

interface WebhookSubscriptionListProps {
  webhookId: string;
}

export function WebhookSubscriptionList({ webhookId }: WebhookSubscriptionListProps) {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/webhooks/${webhookId}/subscriptions`);
      if (!response.ok) throw new Error('Failed to load subscriptions');
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [webhookId]);

  const handleDelete = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;

    try {
      const response = await fetch(
        `/api/v1/webhooks/${webhookId}/subscriptions/${subscriptionId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Failed to delete subscription');
      setSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleFormSuccess = async (subscription: WebhookSubscriptionResponse) => {
    setShowForm(false);
    setEditingId(null);
    await loadSubscriptions();
  };

  if (loading) {
    return <div className="text-center py-4">Loading subscriptions...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
    );
  }

  if (showForm || editingId) {
    const editing = editingId ? subscriptions.find((s) => s.id === editingId) : undefined;
    return (
      <div className="bg-white p-6 rounded border border-[var(--border)]">
        <h3 className="text-lg font-semibold mb-4">
          {editing ? 'Edit Subscription' : 'Create New Subscription'}
        </h3>
        <WebhookSubscriptionForm
          webhookId={webhookId}
          subscription={editing}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Subscriptions ({subscriptions.length})</h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          <Plus size={16} />
          New Subscription
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">
          No subscriptions yet. Create one to start receiving events.
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="border border-[var(--border)] rounded p-4 hover:bg-[var(--background)] transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-[var(--foreground)]">{subscription.name}</h4>
                    {!subscription.active && (
                      <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  {subscription.description && (
                    <p className="text-sm text-[var(--muted)] mb-2">{subscription.description}</p>
                  )}
                  <div className="text-xs text-[var(--muted)]">
                    <p>Events: {subscription.eventTypes.join(', ')}</p>
                    {subscription.productEventFilter?.types &&
                      subscription.productEventFilter.types.length > 0 && (
                        <p>
                          Product Event Types: {subscription.productEventFilter.types.join(', ')}
                        </p>
                      )}
                    {subscription.productEventFilter?.productIds &&
                      subscription.productEventFilter.productIds.length > 0 && (
                        <p>Products: {subscription.productEventFilter.productIds.join(', ')}</p>
                      )}
                    <p>Created: {new Date(subscription.createdAt).toLocaleString()}</p>
                    {subscription.lastTriggeredAt && (
                      <p>
                        Last Triggered: {new Date(subscription.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setEditingId(subscription.id)}
                    className="p-2 hover:bg-gray-200 rounded transition"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(subscription.id)}
                    className="p-2 hover:bg-red-100 rounded transition"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
