/**
 * ============================================================================
 * Workflow DAG Validation & Topological Sort — Distributed Job Scheduler
 * ============================================================================
 * Implements Kahn's Algorithm (Topological Sort) to validate Directed Acyclic
 * Graphs (DAGs) for workflow creation. Detects cyclic dependencies (e.g. A -> B -> A)
 * and returns topologically sorted node execution order.
 */

export interface DagNode {
  id: string;
  [key: string]: any;
}

export interface DagEdge {
  parent: string;
  child: string;
}

export interface DagValidationResult {
  isValid: boolean;
  topologicalOrder?: string[];
  error?: string;
}

/**
 * Validates a Workflow DAG structure using Kahn's algorithm.
 *
 * @param nodeIds Set or array of job node identifiers
 * @param edges Directed edges where parent MUST complete before child can run
 */
export function validateWorkflowDag(nodeIds: string[], edges: DagEdge[]): DagValidationResult {
  if (!nodeIds || nodeIds.length === 0) {
    return { isValid: false, error: 'Workflow must contain at least one job node' };
  }

  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size !== nodeIds.length) {
    return { isValid: false, error: 'Duplicate job node identifiers found in workflow' };
  }

  // Build adjacency list & calculate in-degrees
  const inDegree: Map<string, number> = new Map();
  const adjacencyList: Map<string, string[]> = new Map();

  for (const id of uniqueNodeIds) {
    inDegree.set(id, 0);
    adjacencyList.set(id, []);
  }

  for (const edge of edges) {
    if (!uniqueNodeIds.has(edge.parent)) {
      return { isValid: false, error: `Edge references unknown parent node: '${edge.parent}'` };
    }
    if (!uniqueNodeIds.has(edge.child)) {
      return { isValid: false, error: `Edge references unknown child node: '${edge.child}'` };
    }
    if (edge.parent === edge.child) {
      return { isValid: false, error: `Self-referencing dependency detected on node: '${edge.parent}'` };
    }

    const currentChildren = adjacencyList.get(edge.parent)!;
    currentChildren.push(edge.child);

    inDegree.set(edge.child, (inDegree.get(edge.child) || 0) + 1);
  }

  // Queue of nodes with 0 in-degree (root nodes ready for immediate execution)
  const queue: string[] = [];
  for (const [id, count] of inDegree.entries()) {
    if (count === 0) {
      queue.push(id);
    }
  }

  const topologicalOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    topologicalOrder.push(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      const updatedDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If topologicalOrder count matches node count, graph is a valid DAG!
  if (topologicalOrder.length !== uniqueNodeIds.size) {
    return {
      isValid: false,
      error: 'Cyclic dependency detected in workflow DAG. Dependent jobs must form a directed acyclic graph.',
    };
  }

  return {
    isValid: true,
    topologicalOrder,
  };
}
