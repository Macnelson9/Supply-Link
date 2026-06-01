'use client';

import { CertificationChain, CertificationNode } from '@/lib/services/certificationChainExplorer';

interface CertificationChainExplorerProps {
  chain: CertificationChain;
  onNodeClick?: (certId: string) => void;
}

export function CertificationChainExplorer({
  chain,
  onNodeClick,
}: CertificationChainExplorerProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-lg mb-4">Certification Chain</h3>

        <div className="space-y-3">
          {chain.nodes.map((node) => (
            <CertificationNodeCard
              key={node.cert_id}
              node={node}
              onClick={() => onNodeClick?.(node.cert_id)}
            />
          ))}
        </div>

        {chain.nodes.length === 0 && (
          <p className="text-gray-500 text-center py-4">No certifications in chain</p>
        )}
      </div>

      <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-sm">
        <p className="text-blue-900">
          <strong>Chain Depth:</strong> {chain.depth} levels
        </p>
      </div>
    </div>
  );
}

interface CertificationNodeCardProps {
  node: CertificationNode;
  onClick?: () => void;
}

function CertificationNodeCard({ node, onClick }: CertificationNodeCardProps) {
  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{node.cert_type}</p>
          <p className="text-sm text-gray-600">ID: {node.cert_id.substring(0, 16)}...</p>
          <p className="text-xs text-gray-500">Issuer: {node.issuer.substring(0, 10)}...</p>
        </div>
        {node.revoked && (
          <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">
            Revoked
          </span>
        )}
      </div>

      {(node.dependencies.length > 0 || node.dependents.length > 0) && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
          {node.dependencies.length > 0 && (
            <p>Depends on: {node.dependencies.length} certification(s)</p>
          )}
          {node.dependents.length > 0 && (
            <p>Required by: {node.dependents.length} certification(s)</p>
          )}
        </div>
      )}
    </div>
  );
}
