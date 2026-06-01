import { useCallback } from 'react';
import { ActorTrustWeight, calculateTrustScore } from '@/lib/services/trustManagement';

export function useTrustManagement() {
  const getTrustStatus = useCallback((trust: ActorTrustWeight) => {
    return calculateTrustScore(trust);
  }, []);

  const isTrusted = useCallback((trust: ActorTrustWeight): boolean => {
    return !trust.blacklisted && trust.trust_weight >= 75;
  }, []);

  const isSuspicious = useCallback((trust: ActorTrustWeight): boolean => {
    return !trust.blacklisted && trust.trust_weight < 50;
  }, []);

  return {
    getTrustStatus,
    isTrusted,
    isSuspicious,
  };
}
