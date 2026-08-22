import React, { useState, useEffect } from 'react';
import { GitMerge, Plus, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, ArrowRight, Play, Ban } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface WorkflowNode {
  id: string;
  type: string;
  status: string;
  queueName: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  unresolvedParentCount: number;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorReason?: string;
  parentJobIds: string[];
  childJobIds: string[];
}

interface WorkflowEdge {
  parent: string;
  child: string;
}

interface WorkflowDetail {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  progressPercentage: number;
}

interface WorkflowsViewProps {
  onRefresh: () => void;
  lastUpdatedTs?: number;
}

export function WorkflowsView({ onRefresh, lastUpdatedTs }: WorkflowsViewProps) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{ workflow: WorkflowDetail; nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Realtime update trigger when WebSocket/polling snapshot pulses
  useEffect(() => {
    if (lastUpdatedTs) {
      fetchWorkflowsSilently();
    }
  }, [lastUpdatedTs]);

  // Active polling loop while any workflow in the list is RUNNING / PENDING
  useEffect(() => {
    const hasActiveWorkflows = workflows.some((w) => w.status === 'RUNNING' || w.status === 'PENDING');
    if (!hasActiveWorkflows) return;

    const interval = setInterval(() => {
      fetchWorkflowsSilently();
    }, 1500);

    return () => clearInterval(interval);
  }, [workflows, selectedWorkflowId]);

  const fetchWorkflows = async () => {
    setLoading(true);
    await fetchWorkflowsSilently();
    setLoading(false);
  };

  const fetchWorkflowsSilently = async () => {
    try {
      const data = await fetchApi<{ workflows: any[] }>('/workflows');
      setWorkflows(data.workflows || []);
      
      const currentSelected = selectedWorkflowId || data.workflows?.[0]?.id;
      if (currentSelected) {
        if (!selectedWorkflowId) setSelectedWorkflowId(currentSelected);
        fetchWorkflowDetail(currentSelected);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    }
  };

  const fetchWorkflowDetail = async (id: string) => {
    setSelectedWorkflowId(id);
    try {
      const data = await fetchApi<{ workflow: WorkflowDetail; nodes: WorkflowNode[]; edges: WorkflowEdge[] }>(`/workflows/${id}`);
      setSelectedDetail(data);
    } catch (err) {
      console.error('Failed to fetch workflow detail:', err);
    }
  };

  const cancelWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this workflow and all non-completed jobs in it?')) return;
    try {
      await fetchApi(`/workflows/${id}/cancel`, { method: 'POST' });
      fetchWorkflows();
      if (selectedWorkflowId === id) {
        fetchWorkflowDetail(id);
      }
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED</span>;
      case 'RUNNING':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1 animate-pulse"><Play className="w-3.5 h-3.5" /> RUNNING</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> FAILED</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> PENDING</span>;
    }
  };

  const getNodeStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10';
      case 'RUNNING':
      case 'CLAIMED':
        return 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-indigo-500/25 animate-pulse';
      case 'QUEUED':
        return 'bg-sky-950/40 border-sky-500/60 text-sky-300 shadow-sky-500/10';
      case 'BLOCKED':
        return 'bg-slate-900/60 border-slate-700 text-slate-400 border-dashed opacity-80';
      case 'FAILED':
      case 'DEAD':
        return 'bg-rose-950/40 border-rose-500/60 text-rose-300 shadow-rose-500/10';
      case 'CANCELLED':
        return 'bg-amber-950/30 border-amber-600/40 text-amber-400 line-through';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-300';
    }
  };

  const launchSampleWorkflow = async () => {
    setLoading(true);
    try {
      // Fetch available queues & projects using authenticated fetchApi
      let queueRes = await fetchApi<{ queues: any[] }>('/queues');
      let queueId = queueRes.queues?.[0]?.id;
      let projectId = queueRes.queues?.[0]?.projectId;

      if (!queueId || !projectId) {
        // If no queue/project exists yet, create org -> project -> queue automatically
        const orgRes = await fetchApi<{ organization: { id: string } }>('/organizations', {
          method: 'POST',
          body: JSON.stringify({ name: 'Codity Dashboard Org', slug: `dashboard-org-${Date.now()}` }),
        });
        const orgId = orgRes.organization.id;

        const projRes = await fetchApi<{ project: { id: string } }>('/projects', {
          method: 'POST',
          body: JSON.stringify({ organizationId: orgId, name: 'Main Pipelines', slug: `dash-proj-${Date.now()}` }),
        });
        projectId = projRes.project.id;

        const qRes = await fetchApi<{ queue: { id: string } }>('/queues', {
          method: 'POST',
          body: JSON.stringify({ projectId, name: `workflow-queue-${Date.now()}`, priority: 20, concurrencyLimit: 10 }),
        });
        queueId = qRes.queue.id;
      }

      const data = await fetchApi<any>('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name: `Sample Analytics Pipeline #${Math.floor(Math.random() * 1000)}`,
          description: 'Automated 4-step DAG workflow with parallel fan-out and fan-in resolution',
          nodes: [
            { key: 'ingest_data', queueId, type: 'report_generation', payload: { reportType: 'raw_telemetry' }, priority: 30, parents: [] },
            { key: 'send_alerts', queueId, type: 'email_notification', payload: { to: 'ops@codity.ai', subject: 'Data Ingestion Complete' }, priority: 20, parents: ['ingest_data'] },
            { key: 'sync_warehouse', queueId, type: 'webhook_delivery', payload: { url: 'https://warehouse.internal/sync' }, priority: 20, parents: ['ingest_data'] },
            { key: 'final_summary', queueId, type: 'report_generation', payload: { reportType: 'executive_pdf' }, priority: 10, parents: ['send_alerts', 'sync_warehouse'] },
          ],
        }),
      });

      await fetchWorkflows();
      if (data.workflow?.id) {
        fetchWorkflowDetail(data.workflow.id);
      }
    } catch (err: any) {
      console.error('Failed to launch sample workflow:', err);
      alert(`Failed to launch workflow: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/50 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">Workflow DAG Pipelines</h2>
            <p className="text-xs text-slate-400">Multi-step parent-child execution dependency graphs</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={launchSampleWorkflow}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Launch Sample Workflow DAG
          </button>
          <button
            onClick={fetchWorkflows}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} /> Refresh Workflows
          </button>
        </div>
      </div>

      {/* Main Grid: Left Workflow Selector, Right Interactive DAG Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Workflows Sidebar List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Active & Past Pipelines ({workflows.length})</h3>

          {loading && workflows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-2xl">
              Loading workflow pipelines...
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
              <GitMerge className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-bold text-slate-300">No Workflows created yet.</p>
              <p className="text-[11px] text-slate-500">Launch a sample 4-step fan-out fan-in DAG workflow to visualize parent-child execution in action.</p>
              <button
                onClick={launchSampleWorkflow}
                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Launch Sample Workflow DAG
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {workflows.map((wf) => {
                const isSelected = selectedWorkflowId === wf.id;
                return (
                  <div
                    key={wf.id}
                    onClick={() => fetchWorkflowDetail(wf.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">{wf.name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">{wf.projectName}</span>
                      </div>
                      {getStatusBadge(wf.status)}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 mt-3">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>Progress ({wf.stats.completedJobs}/{wf.stats.totalJobs} jobs)</span>
                        <span>{wf.stats.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${wf.stats.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-3 pt-2 border-t border-slate-800/60">
                      <span>{new Date(wf.createdAt).toLocaleTimeString()}</span>
                      <div className="flex gap-1.5">
                        {wf.stats.blockedJobs > 0 && <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">🔒 {wf.stats.blockedJobs}</span>}
                        {wf.stats.queuedJobs > 0 && <span className="px-1.5 py-0.2 bg-sky-950 text-sky-400 rounded">⏳ {wf.stats.queuedJobs}</span>}
                        {wf.stats.runningJobs > 0 && <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-400 rounded">⚡ {wf.stats.runningJobs}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflow Detail & Interactive DAG Graph Inspector */}
        <div className="lg:col-span-8">
          {selectedDetail ? (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-5">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white tracking-tight">{selectedDetail.workflow.name}</h3>
                    {getStatusBadge(selectedDetail.workflow.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Workflow ID: <span className="font-mono text-slate-300">{selectedDetail.workflow.id}</span></p>
                </div>

                {selectedDetail.workflow.status === 'RUNNING' || selectedDetail.workflow.status === 'PENDING' ? (
                  <button
                    onClick={() => cancelWorkflow(selectedDetail.workflow.id)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel Workflow
                  </button>
                ) : null}
              </div>

              {/* Interactive DAG Nodes Flow */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-indigo-400" /> DAG Execution Nodes ({selectedDetail.nodes.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  {selectedDetail.nodes.map((node) => {
                    const isSelected = activeNodeId === node.id;
                    const hasParents = node.parentJobIds.length > 0;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setActiveNodeId(isSelected ? null : node.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer relative shadow-lg ${getNodeStatusColor(node.status)} ${
                          isSelected ? 'ring-2 ring-indigo-400' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700/60 text-slate-300">
                              {node.type}
                            </span>
                            <div className="text-[11px] font-mono text-slate-400 mt-1">
                              Queue: <span className="text-slate-200">{node.queueName}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-slate-950/60">
                            {node.status}
                          </span>
                        </div>

                        {/* Dependencies badges */}
                        <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400">
                            {hasParents ? `Parents: ${node.parentJobIds.length}` : 'Root Node'}
                          </span>
                          {node.unresolvedParentCount > 0 && (
                            <span className="text-amber-400 flex items-center gap-1">
                              🔒 {node.unresolvedParentCount} pending
                            </span>
                          )}
                        </div>

                        {/* Error info if failed */}
                        {node.errorReason && (
                          <div className="mt-2 text-[10px] text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-800/50 font-mono">
                            ⚠️ {node.errorReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Edge Connections List */}
              <div className="pt-4 border-t border-slate-800/60 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Directed Graph Edges ({selectedDetail.edges.length})</h4>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  {selectedDetail.edges.map((edge, idx) => (
                    <div key={idx} className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 flex items-center gap-2">
                      <span className="text-indigo-400 font-bold">{edge.parent.substring(0, 8)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-emerald-400 font-bold">{edge.child.substring(0, 8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              Select a workflow pipeline from the list to view its DAG structure and job dependencies.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
