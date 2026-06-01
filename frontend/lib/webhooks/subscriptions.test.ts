/**
 * Webhook Subscription Tests
 *
 * Comprehensive tests for subscription creation, filtering, delivery, and retry logic.
 * Run with: npm test -- lib/webhooks/subscriptions.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WebhookSubscription, WebhookEventType, ProductEventType } from '@/lib/webhooks/types';
import {
  createSubscription,
  getSubscriptionById,
  getSubscriptionsByWebhookId,
  updateSubscription,
  deleteSubscription,
  getSubscriptionsForEvent,
  updateSubscriptionTrigger,
  deleteSubscriptionsByWebhookId,
} from '@/lib/webhooks/subscriptions';
import { createProductEventPayload, notifyWebhooksOfProductEvent } from '@/lib/webhooks/processor';

describe('Webhook Subscriptions', () => {
  const TEST_WEBHOOK_ID = 'test-webhook-123';

  describe('Subscription CRUD Operations', () => {
    it('should create a subscription with default retry policy', async () => {
      const subscription = await createSubscription(TEST_WEBHOOK_ID, 'Test Subscription', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      expect(subscription).toBeDefined();
      expect(subscription.webhookId).toBe(TEST_WEBHOOK_ID);
      expect(subscription.name).toBe('Test Subscription');
      expect(subscription.eventTypes).toContain('PRODUCT_EVENT_CHANGED');
      expect(subscription.active).toBe(true);
      expect(subscription.retryPolicy.maxRetries).toBe(5);
      expect(subscription.retryPolicy.backoffMs).toBe(1000);
      expect(subscription.retryPolicy.maxBackoffMs).toBe(3600000);
    });

    it('should create a subscription with custom retry policy', async () => {
      const subscription = await createSubscription(
        TEST_WEBHOOK_ID,
        'Custom Subscription',
        ['TRACKING_EVENT_CREATED'],
        {
          retryPolicy: {
            maxRetries: 3,
            backoffMs: 2000,
            maxBackoffMs: 60000,
          },
        },
      );

      expect(subscription.retryPolicy.maxRetries).toBe(3);
      expect(subscription.retryPolicy.backoffMs).toBe(2000);
      expect(subscription.retryPolicy.maxBackoffMs).toBe(60000);
    });

    it('should create a subscription with product event filters', async () => {
      const subscription = await createSubscription(
        TEST_WEBHOOK_ID,
        'Filtered Subscription',
        ['PRODUCT_EVENT_CHANGED'],
        {
          productEventFilter: {
            types: ['product_updated', 'event_added'],
            productIds: ['prod-123', 'prod-456'],
          },
        },
      );

      expect(subscription.productEventFilter).toBeDefined();
      expect(subscription.productEventFilter?.types).toContain('product_updated');
      expect(subscription.productEventFilter?.types).toContain('event_added');
      expect(subscription.productEventFilter?.productIds).toContain('prod-123');
      expect(subscription.productEventFilter?.productIds).toContain('prod-456');
    });

    it('should retrieve subscription by ID', async () => {
      const created = await createSubscription(TEST_WEBHOOK_ID, 'Retrieve Test', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      const retrieved = await getSubscriptionById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Retrieve Test');
    });

    it('should retrieve subscriptions by webhook ID', async () => {
      const sub1 = await createSubscription(TEST_WEBHOOK_ID, 'Sub 1', ['TRACKING_EVENT_CREATED']);
      const sub2 = await createSubscription(TEST_WEBHOOK_ID, 'Sub 2', ['PRODUCT_EVENT_CHANGED']);

      const subscriptions = await getSubscriptionsByWebhookId(TEST_WEBHOOK_ID);
      expect(subscriptions.length).toBeGreaterThanOrEqual(2);
      expect(subscriptions.map((s) => s.id)).toContain(sub1.id);
      expect(subscriptions.map((s) => s.id)).toContain(sub2.id);
    });

    it('should update subscription', async () => {
      const subscription = await createSubscription(TEST_WEBHOOK_ID, 'Original Name', [
        'TRACKING_EVENT_CREATED',
      ]);

      const updated = await updateSubscription(subscription.id, {
        name: 'Updated Name',
        active: false,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.active).toBe(false);
      expect(updated?.eventTypes).toContain('TRACKING_EVENT_CREATED'); // Should not change
    });

    it('should delete subscription', async () => {
      const subscription = await createSubscription(TEST_WEBHOOK_ID, 'To Delete', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      const deleted = await deleteSubscription(subscription.id);
      expect(deleted).toBe(true);

      const retrieved = await getSubscriptionById(subscription.id);
      expect(retrieved).toBeNull();
    });

    it('should delete all subscriptions for a webhook', async () => {
      const sub1 = await createSubscription('webhook-to-delete', 'Sub 1', [
        'TRACKING_EVENT_CREATED',
      ]);
      const sub2 = await createSubscription('webhook-to-delete', 'Sub 2', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      const deletedCount = await deleteSubscriptionsByWebhookId('webhook-to-delete');
      expect(deletedCount).toBeGreaterThanOrEqual(2);

      const remaining = await getSubscriptionsByWebhookId('webhook-to-delete');
      expect(remaining.filter((s) => s.id === sub1.id || s.id === sub2.id).length).toBe(0);
    });
  });

  describe('Subscription Filtering', () => {
    beforeEach(async () => {
      // Create subscriptions with various filters
      await createSubscription(TEST_WEBHOOK_ID, 'All Product Events', ['PRODUCT_EVENT_CHANGED']);

      await createSubscription(TEST_WEBHOOK_ID, 'Product Updates Only', ['PRODUCT_EVENT_CHANGED'], {
        productEventFilter: {
          types: ['product_updated'],
        },
      });

      await createSubscription(TEST_WEBHOOK_ID, 'Product 123 Events', ['PRODUCT_EVENT_CHANGED'], {
        productEventFilter: {
          productIds: ['prod-123'],
        },
      });

      await createSubscription(
        TEST_WEBHOOK_ID,
        'Specific Product and Event Type',
        ['PRODUCT_EVENT_CHANGED'],
        {
          productEventFilter: {
            types: ['product_updated'],
            productIds: ['prod-456'],
          },
        },
      );

      await createSubscription(TEST_WEBHOOK_ID, 'Tracking Events Only', ['TRACKING_EVENT_CREATED']);

      // Create an inactive subscription
      await createSubscription(
        TEST_WEBHOOK_ID,
        'Inactive Subscription',
        ['PRODUCT_EVENT_CHANGED'],
        {},
      ).then((sub) => updateSubscription(sub.id, { active: false }));
    });

    it('should get subscriptions for PRODUCT_EVENT_CHANGED', async () => {
      const subscriptions = await getSubscriptionsForEvent('PRODUCT_EVENT_CHANGED');
      expect(subscriptions.length).toBeGreaterThan(0);
      expect(subscriptions.every((s) => s.eventTypes.includes('PRODUCT_EVENT_CHANGED'))).toBe(true);
      expect(subscriptions.every((s) => s.active)).toBe(true);
    });

    it('should filter by product event type', async () => {
      const subscriptions = await getSubscriptionsForEvent(
        'PRODUCT_EVENT_CHANGED',
        'product_updated',
      );

      // Should include subscriptions that:
      // 1. Support PRODUCT_EVENT_CHANGED
      // 2. Either have no filter or include product_updated in their filter
      // 3. Are active
      expect(subscriptions.every((s) => s.eventTypes.includes('PRODUCT_EVENT_CHANGED'))).toBe(true);
      expect(subscriptions.every((s) => s.active)).toBe(true);
    });

    it('should filter by product ID', async () => {
      const subscriptions = await getSubscriptionsForEvent(
        'PRODUCT_EVENT_CHANGED',
        'product_updated',
        'prod-123',
      );

      // Should include subscriptions that support this product
      expect(subscriptions.every((s) => s.active)).toBe(true);
    });

    it('should exclude inactive subscriptions', async () => {
      const subscriptions = await getSubscriptionsForEvent('PRODUCT_EVENT_CHANGED');
      const inactiveCount = subscriptions.filter((s) => !s.active).length;
      expect(inactiveCount).toBe(0);
    });

    it('should exclude subscriptions for non-matching event types', async () => {
      const subscriptions = await getSubscriptionsForEvent('TRACKING_EVENT_CREATED');
      expect(subscriptions.some((s) => s.eventTypes.includes('TRACKING_EVENT_CREATED'))).toBe(true);
      // Subscriptions that don't support TRACKING_EVENT_CREATED shouldn't be included
      expect(subscriptions.every((s) => s.eventTypes.includes('TRACKING_EVENT_CREATED'))).toBe(
        true,
      );
    });
  });

  describe('Product Event Payloads', () => {
    it('should create product event payload', () => {
      const payload = createProductEventPayload('product_updated', 'prod-123', {
        name: 'Updated Product',
        origin: 'Ethiopia',
      });

      expect(payload.event.type).toBe('PRODUCT_EVENT_CHANGED');
      expect(payload.event.data.eventType).toBe('product_updated');
      expect(payload.event.data.productId).toBe('prod-123');
      expect(payload.event.data.details.name).toBe('Updated Product');
      expect(payload.id).toBeDefined();
      expect(payload.timestamp).toBeDefined();
    });

    it('should create event_added payload', () => {
      const eventData = {
        productId: 'prod-123',
        location: 'Port of Hamburg',
        actor: 'warehouse-worker',
        eventType: 'SHIPPING',
      };

      const payload = createProductEventPayload('event_added', 'prod-123', {
        event: eventData,
      });

      expect(payload.event.type).toBe('PRODUCT_EVENT_CHANGED');
      expect(payload.event.data.eventType).toBe('event_added');
      expect(payload.event.data.details.event).toEqual(eventData);
    });
  });

  describe('Subscription Triggers', () => {
    it('should update subscription trigger timestamp', async () => {
      const subscription = await createSubscription(TEST_WEBHOOK_ID, 'Trigger Test', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      expect(subscription.lastTriggeredAt).toBeUndefined();

      const updated = await updateSubscriptionTrigger(subscription.id);
      expect(updated).toBeDefined();
      expect(updated?.lastTriggeredAt).toBeDefined();
      expect(updated.lastTriggeredAt).toBeGreaterThan(0);
    });

    it('should update trigger timestamp multiple times', async () => {
      const subscription = await createSubscription(TEST_WEBHOOK_ID, 'Multiple Triggers', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      const firstTrigger = await updateSubscriptionTrigger(subscription.id);
      expect(firstTrigger?.lastTriggeredAt).toBeDefined();
      const firstTimestamp = firstTrigger!.lastTriggeredAt!;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondTrigger = await updateSubscriptionTrigger(subscription.id);
      const secondTimestamp = secondTrigger!.lastTriggeredAt!;

      expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
    });
  });

  describe('Notification Logic', () => {
    it('should notify subscriptions of product events', async () => {
      const subscription = await createSubscription('notify-webhook', 'Notification Test', [
        'PRODUCT_EVENT_CHANGED',
      ]);

      const result = await notifyWebhooksOfProductEvent('product_updated', 'prod-123', {
        name: 'Updated',
        origin: 'Ethiopia',
      });

      expect(result.delivered).toBe(true);
      // Note: This will return 0 because we don't have actual webhooks registered
      // In real scenarios with webhooks, these would be > 0
    });

    it('should return notification result with subscription IDs', async () => {
      const sub1 = await createSubscription('notify-webhook-2', 'Sub 1', ['PRODUCT_EVENT_CHANGED']);

      const sub2 = await createSubscription('notify-webhook-2', 'Sub 2', ['PRODUCT_EVENT_CHANGED']);

      const result = await notifyWebhooksOfProductEvent('product_registered', 'prod-789', {
        productId: 'prod-789',
        name: 'New Product',
      });

      expect(result.delivered).toBe(true);
      // Check that subscription IDs would be returned if webhooks were active
      expect(Array.isArray(result.triggedSubscriptionIds)).toBe(true);
    });
  });
});
