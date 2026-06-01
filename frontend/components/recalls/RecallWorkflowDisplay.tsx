'use client';

import {
  RecallWorkflow,
  getRecallStatusColor,
  getJurisdictionName,
} from '@/lib/services/recallManagement';

interface RecallWorkflowDisplayProps {
  workflow: RecallWorkflow;
}

export function RecallWorkflowDisplay({ workflow }: RecallWorkflowDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Recall Workflow</h3>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{workflow.completion_percentage}%</p>
            <p className="text-xs text-gray-600">Complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${workflow.completion_percentage}%` }}
          />
        </div>

        {/* Jurisdictions */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Affected Jurisdictions:</p>
          <div className="flex flex-wrap gap-2">
            {workflow.affected_jurisdictions.map((jurisdiction) => (
              <span
                key={jurisdiction}
                className="inline-block px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full"
              >
                {getJurisdictionName(jurisdiction)}
              </span>
            ))}
          </div>
        </div>

        {/* Stages */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Recall Stages:</p>
          {workflow.stages.map((stage) => (
            <div
              key={stage.stage_id}
              className={`p-3 rounded-lg ${getRecallStatusColor(stage.stage_type)}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{stage.stage_type}</p>
                  <p className="text-xs opacity-75">{getJurisdictionName(stage.jurisdiction)}</p>
                </div>
                <p className="text-xs opacity-75">
                  {new Date(stage.updated_at * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
