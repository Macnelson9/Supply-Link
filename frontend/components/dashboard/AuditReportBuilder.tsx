'use client';

import { useState } from 'react';
import { useStore } from '@/lib/state/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, FileJson, FileText } from 'lucide-react';
import {
  generateAuditReport,
  downloadReport,
  type AuditReportFilter,
  type AuditReportData,
} from '@/lib/services/auditReportService';

export function AuditReportBuilder() {
  const { products, events } = useStore();
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const eventTypes = Array.from(new Set(events.map((e) => e.event_type)));

  const handleGenerateReport = () => {
    setIsGenerating(true);
    try {
      const filter: AuditReportFilter = {
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime() + 86400000, // Include full end day
        eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
      };

      const generatedReport = generateAuditReport(products, events, filter);
      setReport(generatedReport);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleEventType = (type: string) => {
    setSelectedEventTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Audit Report Builder
        </h2>

        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Event Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Types</label>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleEventType(type)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedEventTypes.includes(type)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedEventTypes.length === 0
                ? 'All event types'
                : `${selectedEventTypes.length} selected`}
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </Card>

      {/* Report Results */}
      {report && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Report Summary</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{report.summary.totalProducts}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{report.summary.totalEvents}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Products with Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {report.summary.productsWithEvents}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Date Range</p>
              <p className="text-sm font-bold text-gray-900">
                {new Date(report.filter.startDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Events by Type */}
          {Object.keys(report.summary.eventsByType).length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Events by Type</h4>
              <div className="space-y-2">
                {Object.entries(report.summary.eventsByType).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-700">{type}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => downloadReport(report, 'json')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </Button>
            <Button
              onClick={() => downloadReport(report, 'csv')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
