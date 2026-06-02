'use client';

import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import type { TrackingEvent, EventType } from '@/lib/types';
import { calculateActorReputations, calculateEventTrust, getEventTrustBadgeClass } from '@/lib/services/eventTrust';
import { PrivateMetadataViewer } from './PrivateMetadataViewer';

const DEFAULT_EVENT_LABELS: Record<EventType, string> = {
  HARVEST: 'Harvest',
  PROCESSING: 'Processing',
  SHIPPING: 'Shipping',
  RETAIL: 'Retail',
};

const EVENT_COLORS: Record<EventType, string> = {
  HARVEST: 'bg-green-500',
  PROCESSING: 'bg-blue-500',
  SHIPPING: 'bg-yellow-500',
  RETAIL: 'bg-purple-500',
};

interface EventTimelineProps {
  events: TrackingEvent[];
  /** Localized event-type labels; falls back to English when omitted. */
  labels?: Partial<Record<EventType, string>>;
  /** Localized empty-state message; falls back to English when omitted. */
  emptyLabel?: string;
  /** BCP-47 locale used to format timestamps; falls back to runtime default. */
  locale?: string;
  /**
   * When true, archived events are hidden by default and a toggle is shown.
   * Defaults to true — archived events are excluded from the active timeline.
   */
  hideArchivedByDefault?: boolean;
  /** Called when the user requests to archive an event. */
  onArchiveRequest?: (stableId: string) => void;
}

export function EventTimeline({
  events,
  labels,
  emptyLabel,
  locale,
  hideArchivedByDefault = true,
  onArchiveRequest,
}: EventTimelineProps) {
  const [showArchived, setShowArchived] = useState(false);

  const labelFor = (type: EventType) => labels?.[type] ?? DEFAULT_EVENT_LABELS[type];
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const eventTrusts = useMemo(() => {
    const reputations = calculateActorReputations(events);
    const reputationByActor = new Map(reputations.map((r) => [r.actor, r]));
    return new Map(
      events.map((event) => {
        const trust = calculateEventTrust(event, reputationByActor.get(event.actor));
        return [event.stableId ?? `${event.actor}-${event.timestamp}`, trust] as const;
      }),
    );
  }, [events]);

  const activeEvents = hideArchivedByDefault && !showArchived
    ? events.filter((e) => !e.archived)
    : events;

  const archivedCount = events.filter((e) => e.archived).length;

  return (
    <div>
      {/* Archive toggle — only shown when there are archived events */}
      {archivedCount > 0 && hideArchivedByDefault && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Archive size={13} />
            {showArchived
              ? `Hide ${archivedCount} archived event${archivedCount !== 1 ? 's' : ''}`
              : `Show ${archivedCount} archived event${archivedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {activeEvents.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyLabel ?? 'No events recorded yet.'}</p>
      ) : (
        <ol className="relative border-l border-[var(--card-border)] ml-2 space-y-6">
          {activeEvents.map((event, i) => (
            <li
              key={event.stableId ?? i}
              className={`ml-5 ${event.archived ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute -left-2 mt-1 h-4 w-4 rounded-full border-2 border-[var(--background)] ${EVENT_COLORS[event.eventType]}`}
              />
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
                  {labelFor(event.eventType)}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {dateFmt.format(new Date(event.timestamp))}
                </span>
                {event.archived && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--card-border)]">
                    <Archive size={10} />
                    Archived
                  </span>
                )}
                {!event.archived && onArchiveRequest && event.stableId && (
                  <button
                    type="button"
                    onClick={() => onArchiveRequest(event.stableId!)}
                    className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    title="Archive this event"
                  >
                    <Archive size={12} />
                  </button>
                )}
              </div>
              <p className="text-sm text-[var(--foreground)]">{event.location}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-[var(--muted)] font-mono truncate">{event.actor}</p>
                {eventTrusts.get(event.stableId ?? `${event.actor}-${event.timestamp}`) && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${getEventTrustBadgeClass(
                      eventTrusts.get(event.stableId ?? `${event.actor}-${event.timestamp}`)!.status,
                    )}`}
                    title={`Actor trust ${eventTrusts.get(event.stableId ?? `${event.actor}-${event.timestamp}`)!.eventTrustWeight}%`}
                  >
                    {eventTrusts.get(event.stableId ?? `${event.actor}-${event.timestamp}`)!.status}
                    <span className="font-semibold">{eventTrusts.get(event.stableId ?? `${event.actor}-${event.timestamp}`)!.eventTrustWeight}%</span>
                  </span>
                )}
              </div>
              {(event as TrackingEvent & { privateMetadata?: boolean; metadataCommitment?: string }).privateMetadata &&
              (event as TrackingEvent & { metadataCommitment?: string }).metadataCommitment ? (
                <div className="mt-2">
                  <PrivateMetadataViewer
                    commitment={(event as TrackingEvent & { metadataCommitment?: string }).metadataCommitment!}
                    authorized={false}
                  />
                </div>
              ) : (
                event.metadata &&
                event.metadata !== '{}' && (
                  <pre className="mt-1 text-xs bg-[var(--muted-bg)] text-[var(--muted)] rounded-md px-3 py-2 overflow-x-auto">
                    {JSON.stringify(JSON.parse(event.metadata), null, 2)}
                  </pre>
                )
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
