'use client';

import { AuditReportBuilder } from '@/components/dashboard/AuditReportBuilder';

export default function ReportsPage() {
  return (
    <main className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Reports</h1>
        <p className="text-gray-600">
          Generate custom lifecycle audit reports with time-windowed data.
        </p>
      </div>

      <AuditReportBuilder />
    </main>
  );
}
