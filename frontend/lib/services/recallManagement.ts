/**
 * Multi-Stage Recall Management Service (#497)
 * Handles jurisdiction-aware product recalls with stage tracking
 */

export interface RecallStage {
  stage_id: string;
  product_id: string;
  jurisdiction: string; // ISO 3166-1 alpha-2 or "GLOBAL"
  stage_type: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: number;
  updated_at: number;
}

export interface RecallWorkflow {
  product_id: string;
  stages: RecallStage[];
  global_recall: boolean;
  affected_jurisdictions: string[];
  completion_percentage: number;
}

// ISO 3166-1 alpha-2 country codes
const JURISDICTION_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  CN: 'China',
  IN: 'India',
  BR: 'Brazil',
  CA: 'Canada',
  AU: 'Australia',
  GLOBAL: 'Global',
};

/**
 * Get human-readable jurisdiction name
 */
export function getJurisdictionName(code: string): string {
  return JURISDICTION_NAMES[code] || code;
}

/**
 * Build recall workflow from stages
 */
export function buildRecallWorkflow(productId: string, stages: RecallStage[]): RecallWorkflow {
  const jurisdictions = new Set(stages.map((s) => s.jurisdiction));
  const isGlobal = jurisdictions.has('GLOBAL');
  const completedStages = stages.filter((s) => s.stage_type === 'COMPLETED').length;
  const completionPercentage = stages.length > 0 ? (completedStages / stages.length) * 100 : 0;

  return {
    product_id: productId,
    stages,
    global_recall: isGlobal,
    affected_jurisdictions: Array.from(jurisdictions),
    completion_percentage: Math.round(completionPercentage),
  };
}

/**
 * Get stages for a specific jurisdiction
 */
export function getStagesByJurisdiction(
  workflow: RecallWorkflow,
  jurisdiction: string,
): RecallStage[] {
  return workflow.stages.filter(
    (s) => s.jurisdiction === jurisdiction || s.jurisdiction === 'GLOBAL',
  );
}

/**
 * Check if recall is complete for a jurisdiction
 */
export function isRecallComplete(workflow: RecallWorkflow, jurisdiction: string): boolean {
  const stages = getStagesByJurisdiction(workflow, jurisdiction);
  return stages.length > 0 && stages.every((s) => s.stage_type === 'COMPLETED');
}

/**
 * Get next stage in recall workflow
 */
export function getNextRecallStage(
  workflow: RecallWorkflow,
  jurisdiction: string,
): RecallStage | null {
  const stages = getStagesByJurisdiction(workflow, jurisdiction);
  const stageOrder: RecallStage['stage_type'][] = ['INITIATED', 'IN_PROGRESS', 'COMPLETED'];

  for (const stageType of stageOrder) {
    const stage = stages.find((s) => s.stage_type === stageType);
    if (stage) return stage;
  }

  return null;
}

/**
 * Format recall status for display
 */
export function formatRecallStatus(workflow: RecallWorkflow): string {
  if (workflow.global_recall) {
    return `Global Recall - ${workflow.completion_percentage}% Complete`;
  }

  return `Regional Recall (${workflow.affected_jurisdictions.length} jurisdictions) - ${workflow.completion_percentage}% Complete`;
}

/**
 * Get recall status color
 */
export function getRecallStatusColor(stageType: RecallStage['stage_type']): string {
  switch (stageType) {
    case 'INITIATED':
      return 'bg-yellow-100 text-yellow-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
