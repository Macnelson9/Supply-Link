import { describe, it, expect } from 'vitest';
import {
  buildRecallWorkflow,
  getStagesByJurisdiction,
  isRecallComplete,
  getNextRecallStage,
} from '@/lib/services/recallManagement';

describe('Recall Management', () => {
  const mockStages = [
    {
      stage_id: 'stage-1',
      product_id: 'prod-1',
      jurisdiction: 'US',
      stage_type: 'INITIATED' as const,
      created_at: 1000,
      updated_at: 1000,
    },
    {
      stage_id: 'stage-2',
      product_id: 'prod-1',
      jurisdiction: 'US',
      stage_type: 'IN_PROGRESS' as const,
      created_at: 2000,
      updated_at: 2000,
    },
    {
      stage_id: 'stage-3',
      product_id: 'prod-1',
      jurisdiction: 'EU',
      stage_type: 'INITIATED' as const,
      created_at: 3000,
      updated_at: 3000,
    },
  ];

  it('should build recall workflow', () => {
    const workflow = buildRecallWorkflow('prod-1', mockStages);

    expect(workflow.product_id).toBe('prod-1');
    expect(workflow.stages).toEqual(mockStages);
    expect(workflow.affected_jurisdictions).toContain('US');
    expect(workflow.affected_jurisdictions).toContain('EU');
  });

  it('should calculate completion percentage', () => {
    const completedStages = [
      ...mockStages.slice(0, 2),
      {
        ...mockStages[2],
        stage_type: 'COMPLETED' as const,
      },
    ];

    const workflow = buildRecallWorkflow('prod-1', completedStages);
    expect(workflow.completion_percentage).toBeGreaterThan(0);
    expect(workflow.completion_percentage).toBeLessThanOrEqual(100);
  });

  it('should get stages by jurisdiction', () => {
    const workflow = buildRecallWorkflow('prod-1', mockStages);
    const usStages = getStagesByJurisdiction(workflow, 'US');

    expect(usStages.length).toBeGreaterThan(0);
    expect(usStages.every((s) => s.jurisdiction === 'US')).toBe(true);
  });

  it('should check if recall is complete', () => {
    const completedStages = mockStages.map((s) => ({
      ...s,
      stage_type: 'COMPLETED' as const,
    }));

    const workflow = buildRecallWorkflow('prod-1', completedStages);
    expect(isRecallComplete(workflow, 'US')).toBe(true);
  });

  it('should get next recall stage', () => {
    const workflow = buildRecallWorkflow('prod-1', mockStages);
    const nextStage = getNextRecallStage(workflow, 'US');

    expect(nextStage).toBeDefined();
    expect(nextStage?.stage_type).toBe('INITIATED');
  });
});
