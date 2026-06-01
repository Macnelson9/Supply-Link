import { useCallback } from 'react';
import {
  RecallStage,
  RecallWorkflow,
  buildRecallWorkflow,
  getStagesByJurisdiction,
  isRecallComplete,
  getNextRecallStage,
} from '@/lib/services/recallManagement';

export function useRecallManagement() {
  const buildWorkflow = useCallback((productId: string, stages: RecallStage[]) => {
    return buildRecallWorkflow(productId, stages);
  }, []);

  const getStages = useCallback((workflow: RecallWorkflow, jurisdiction: string) => {
    return getStagesByJurisdiction(workflow, jurisdiction);
  }, []);

  const checkComplete = useCallback((workflow: RecallWorkflow, jurisdiction: string): boolean => {
    return isRecallComplete(workflow, jurisdiction);
  }, []);

  const getNextStage = useCallback((workflow: RecallWorkflow, jurisdiction: string) => {
    return getNextRecallStage(workflow, jurisdiction);
  }, []);

  return {
    buildWorkflow,
    getStages,
    checkComplete,
    getNextStage,
  };
}
