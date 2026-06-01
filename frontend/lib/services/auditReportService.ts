import type { Product, TrackingEvent } from '@/lib/types';

export interface AuditReportFilter {
  startDate: number;
  endDate: number;
  productIds?: string[];
  eventTypes?: string[];
}

export interface AuditReportData {
  generatedAt: number;
  filter: AuditReportFilter;
  products: Product[];
  events: TrackingEvent[];
  summary: {
    totalProducts: number;
    totalEvents: number;
    eventsByType: Record<string, number>;
    productsWithEvents: number;
    dateRange: {
      from: string;
      to: string;
    };
  };
}

/**
 * Generate an audit report for products within a custom time window.
 * Filters products and events based on the provided date range and criteria.
 */
export function generateAuditReport(
  products: Product[],
  events: TrackingEvent[],
  filter: AuditReportFilter,
): AuditReportData {
  // Filter events by date range
  const filteredEvents = events.filter((event) => {
    const eventTime = event.timestamp * 1000; // Convert to milliseconds
    return eventTime >= filter.startDate && eventTime <= filter.endDate;
  });

  // Filter by event types if specified
  const typeFilteredEvents = filter.eventTypes
    ? filteredEvents.filter((e) => filter.eventTypes!.includes(e.event_type))
    : filteredEvents;

  // Get product IDs from filtered events
  const eventProductIds = new Set(typeFilteredEvents.map((e) => e.product_id));

  // Filter products
  let filteredProducts = products;
  if (filter.productIds && filter.productIds.length > 0) {
    filteredProducts = products.filter((p) => filter.productIds!.includes(p.id));
  }

  // Count events by type
  const eventsByType: Record<string, number> = {};
  typeFilteredEvents.forEach((event) => {
    eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
  });

  const report: AuditReportData = {
    generatedAt: Date.now(),
    filter,
    products: filteredProducts,
    events: typeFilteredEvents,
    summary: {
      totalProducts: filteredProducts.length,
      totalEvents: typeFilteredEvents.length,
      eventsByType,
      productsWithEvents: eventProductIds.size,
      dateRange: {
        from: new Date(filter.startDate).toISOString(),
        to: new Date(filter.endDate).toISOString(),
      },
    },
  };

  return report;
}

/**
 * Export audit report as JSON.
 */
export function exportReportAsJSON(report: AuditReportData): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export audit report as CSV.
 */
export function exportReportAsCSV(report: AuditReportData): string {
  const lines: string[] = [];

  // Header
  lines.push('Audit Report - Generated at ' + new Date(report.generatedAt).toISOString());
  lines.push('Date Range: ' + report.summary.dateRange.from + ' to ' + report.summary.dateRange.to);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('Total Products,' + report.summary.totalProducts);
  lines.push('Total Events,' + report.summary.totalEvents);
  lines.push('Products with Events,' + report.summary.productsWithEvents);
  lines.push('');

  // Events by type
  lines.push('EVENTS BY TYPE');
  Object.entries(report.summary.eventsByType).forEach(([type, count]) => {
    lines.push(type + ',' + count);
  });
  lines.push('');

  // Events detail
  lines.push('EVENTS DETAIL');
  lines.push('Product ID,Event Type,Location,Actor,Timestamp');
  report.events.forEach((event) => {
    lines.push(
      `"${event.product_id}","${event.event_type}","${event.location}","${event.actor}",${event.timestamp}`,
    );
  });

  return lines.join('\n');
}

/**
 * Download audit report as file.
 */
export function downloadReport(report: AuditReportData, format: 'json' | 'csv' = 'json') {
  const content = format === 'json' ? exportReportAsJSON(report) : exportReportAsCSV(report);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const extension = format === 'json' ? 'json' : 'csv';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-report-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
