import React, { useState, useEffect } from 'react';
import {
  Zap,
  Radio,
  Webhook,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Key,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Code,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface EventSubscription {
  id: string;
  projectId: string;
  name: string;
  eventType: string;
  description?: string | null;
  enabled: boolean;
  targetType: 'JOB' | 'WORKFLOW';
  queueId?: string | null;
  jobType?: string | null;
  jobPayloadTemplate?: any;
  workflowTemplate?: any;
  secret?: string | null;
  createdAt: string;
  project?: { id: string; name: string };
  queue?: { id: string; name: string };
}

interface EventLog {
  id: string;
  projectId: string;
  eventType: string;
  source: string;
  payload: any;
  idempotencyKey?: string | null;
  status: 'PROCESSED' | 'IGNORED' | 'FAILED';
  matchedRuleCount: number;
  triggeredJobIds?: string[] | null;
  triggeredWorkflowIds?: string[] | null;
  errorReason?: string | null;
  signatureVerified: boolean;
  createdAt: string;
  project?: { id: string; name: string };
}

interface EventsViewProps {
  queues?: Array<{ id: string; name: string; priority?: number; projectId?: string }>;
  onRefresh?: () => void;
  lastUpdatedTs?: number;
}

const PRESET_EVENTS = [
  {
    name: 'User Signup (Email Job)',
    eventType: 'user.signup',
    payload: JSON.stringify({
      email: 'alex.mercer@cyberpunk.io',
      name: 'Alex Mercer',
      plan: 'PRO',
      userId: 'usr_9981',
    }, null, 2),
  },
  {
    name: 'Payment Succeeded (DAG Pipeline)',
    eventType: 'payment.success',
    payload: JSON.stringify({
      orderId: 'ORD-77492',
      amount: 149.99,
      customerEmail: 'billing@startup.co',
      currency: 'USD',
    }, null, 2),
  },
  {
    name: 'GitHub Webhook (Deploy)',
    eventType: 'github.push',
    payload: JSON.stringify({
      repo: 'distributed-scheduler',
      branch: 'main',
      commit: '9f8a2b1',
      author: 'lead-architect',
    }, null, 2),
  },
  {
    name: 'IoT Sensor Alert (High Temp)',
    eventType: 'iot.sensor_alert',
    payload: JSON.stringify({
      deviceId: 'SENSOR-ZONE-4B',
      temperatureC: 84.6,
      threshold: 75.0,
      severity: 'CRITICAL',
    }, null, 2),
  },
];

export function EventsView({ queues: initialQueues = [], onRefresh, lastUpdatedTs }: EventsViewProps) {
  const [subscriptions, setSubscriptions] = useState<EventSubscription[]>([]);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulation Sandbox State
  const [simEventType, setSimEventType] = useState('user.signup');
  const [simPayload, setSimPayload] = useState(PRESET_EVENTS[0].payload);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // New Subscription Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubEventType, setNewSubEventType] = useState('user.signup');
  const [newSubTarget, setNewSubTarget] = useState<'JOB' | 'WORKFLOW'>('JOB');
  const [newSubJobType, setNewSubJobType] = useState('email_notification');
  const [newSubSecret, setNewSubSecret] = useState('');
  const [availableQueues, setAvailableQueues] = useState<any[]>(initialQueues);
  const [selectedQueueId, setSelectedQueueId] = useState(initialQueues[0]?.id || '');
  const [creatingQueue, setCreatingQueue] = useState(false);

  // Sync available queues from prop when provided
  useEffect(() => {
    if (initialQueues.length > 0) {
      setAvailableQueues(initialQueues);
      if (!selectedQueueId) {
        setSelectedQueueId(initialQueues[0].id);
      }
    }
  }, [initialQueues]);

  const ensureDefaultQueue = async (): Promise<any> => {
    setCreatingQueue(true);
    try {
      // 1. Check existing queues first
      const qRes = await fetchApi<{ queues: any[] }>('/queues');
      if (qRes.queues && qRes.queues.length > 0) {
        setAvailableQueues(qRes.queues);
        setSelectedQueueId(qRes.queues[0].id);
        setCreatingQueue(false);
        return qRes.queues[0];
      }

      // 2. Fetch or create project
      let projectsRes = await fetchApi<{ projects: any[] }>('/projects');
      let projectId = projectsRes.projects?.[0]?.id;

      if (!projectId) {
        let orgsRes = await fetchApi<{ organizations: any[] }>('/organizations');
        let orgId = orgsRes.organizations?.[0]?.id;

        if (!orgId) {
          const newOrg = await fetchApi<{ organization: { id: string } }>('/organizations', {
            method: 'POST',
            body: JSON.stringify({ name: 'Default Organization', slug: `default-org-${Date.now()}` }),
          });
          orgId = newOrg.organization.id;
        }

        const newProj = await fetchApi<{ project: { id: string } }>('/projects', {
          method: 'POST',
          body: JSON.stringify({ organizationId: orgId, name: 'Default Project', slug: `default-proj-${Date.now()}` }),
        });
        projectId = newProj.project.id;
      }

      // 3. Create default queue
      const createdQ = await fetchApi<{ queue: any }>('/queues', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name: 'event-production-queue',
          priority: 20,
          concurrencyLimit: 10,
        }),
      });

      const newQList = [createdQ.queue];
      setAvailableQueues(newQList);
      setSelectedQueueId(createdQ.queue.id);
      if (onRefresh) onRefresh();
      return createdQ.queue;
    } catch (err) {
      console.error('Failed to auto-create queue:', err);
    } finally {
      setCreatingQueue(false);
    }
  };

  const fetchSubscriptionsAndLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch Subscriptions via authenticated fetchApi
      const subRes = await fetchApi<{ subscriptions: EventSubscription[] }>('/events/subscriptions');
      if (subRes.subscriptions) {
        setSubscriptions(subRes.subscriptions);
      }

      // 2. Fetch Logs via authenticated fetchApi
      const logRes = await fetchApi<{ logs: EventLog[] }>('/events/logs?limit=30');
      if (logRes.logs) {
        setLogs(logRes.logs);
      }

      // 3. Fetch Queues
      const qRes = await fetchApi<{ queues: any[] }>('/queues');
      if (qRes.queues && qRes.queues.length > 0) {
        setAvailableQueues(qRes.queues);
        if (!selectedQueueId) {
          setSelectedQueueId(qRes.queues[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch event data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionsAndLogs();
  }, [lastUpdatedTs]);

  const handleToggleSub = async (sub: EventSubscription) => {
    try {
      await fetchApi(`/events/subscriptions/${sub.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !sub.enabled }),
      });
      fetchSubscriptionsAndLogs();
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event subscription rule?')) return;
    try {
      await fetchApi(`/events/subscriptions/${id}`, {
        method: 'DELETE',
      });
      fetchSubscriptionsAndLogs();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName || !newSubEventType) return;

    try {
      let activeQueue = availableQueues.find((q) => q.id === selectedQueueId) || availableQueues[0];

      if (!activeQueue) {
        activeQueue = await ensureDefaultQueue();
      }

      const defaultProjectId = activeQueue?.projectId || (await ensureDefaultQueue())?.projectId;
      if (!defaultProjectId) {
        alert('Please create a project or queue first');
        return;
      }

      const queueToUse = selectedQueueId || activeQueue.id;

      const body: any = {
        projectId: defaultProjectId,
        name: newSubName,
        eventType: newSubEventType,
        targetType: newSubTarget,
        secret: newSubSecret || undefined,
      };

      if (newSubTarget === 'JOB') {
        body.queueId = queueToUse;
        body.jobType = newSubJobType;
        body.jobPayloadTemplate = {
          recipient: '{{event.email}}',
          name: '{{event.name}}',
          triggeredBy: 'Event {{eventType}}',
        };
      } else {
        body.workflowTemplate = {
          name: `${newSubName} Pipeline`,
          description: `Auto-dispatched on ${newSubEventType}`,
          nodes: [
            {
              key: 'step_1',
              queueId: queueToUse,
              type: 'report_generation',
              payload: { event: '{{eventType}}', stage: 'initial_processing' },
              parents: [],
            },
            {
              key: 'step_2',
              queueId: queueToUse,
              type: 'email_notification',
              payload: { to: '{{event.email}}', summary: 'Pipeline completed' },
              parents: ['step_1'],
            },
          ],
        };
      }

      await fetchApi('/events/subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      setNewSubName('');
      setNewSubSecret('');
      fetchSubscriptionsAndLogs();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      alert(`Failed to create trigger: ${err.message}`);
    }
  };

  const handleSimulateEvent = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(simPayload);
      } catch {
        alert('Invalid JSON in payload editor');
        setSimulating(false);
        return;
      }

      let targetProjectId = subscriptions[0]?.projectId || availableQueues[0]?.projectId;

      if (!targetProjectId) {
        const defaultQ = await ensureDefaultQueue();
        targetProjectId = defaultQ?.projectId;
      }

      if (!targetProjectId) {
        alert('No project found to dispatch event against.');
        setSimulating(false);
        return;
      }

      const res = await fetchApi<any>('/events/publish', {
        method: 'POST',
        body: JSON.stringify({
          projectId: targetProjectId,
          eventType: simEventType,
          payload: parsedPayload,
          source: 'SIMULATION',
        }),
      });

      setSimulationResult(res);
      fetchSubscriptionsAndLogs();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setSimulationResult({ error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const copyWebhookUrl = (subId: string) => {
    const url = `${window.location.origin}/api/v1/events/webhook/${subId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(subId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              Event-Driven Execution & Inbound Webhooks
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Bonus Feature Active
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Trigger instant individual Jobs or multi-node DAG Workflows from inbound webhooks, API events, and pub/sub topics with HMAC SHA-256 security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (availableQueues.length === 0) {
                ensureDefaultQueue();
              }
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-zinc-600 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-orange-400" /> New Event Trigger
          </button>
          <button
            onClick={fetchSubscriptionsAndLogs}
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Event Engine"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Columns (Left: Interactive Sandbox, Right: Subscription Rules) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Event Dispatch Sandbox (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Interactive Event Dispatcher Sandbox</h3>
              </div>
              <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-500 uppercase">Live Simulation</span>
            </div>

            {/* Presets */}
            <div className="mt-4">
              <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Load Preset Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_EVENTS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setSimEventType(preset.eventType);
                      setSimPayload(preset.payload);
                    }}
                    className={`px-3 py-2 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                      simEventType === preset.eventType
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold ring-1 ring-orange-500/30'
                        : 'border-stone-200 dark:border-zinc-800/80 bg-stone-50 dark:bg-zinc-900/40 text-stone-700 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="truncate font-semibold">{preset.name}</div>
                    <div className="text-[10px] font-mono opacity-70 truncate">{preset.eventType}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Name Input */}
            <div className="mt-4">
              <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Event Type / Topic
              </label>
              <div className="relative">
                <Radio className="w-4 h-4 text-stone-400 dark:text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={simEventType}
                  onChange={(e) => setSimEventType(e.target.value)}
                  placeholder="e.g. payment.success, user.signup"
                  className="w-full bg-stone-50 dark:bg-zinc-900/80 border border-stone-300 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* JSON Payload Editor */}
            <div className="mt-4">
              <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between mb-1.5">
                <span>Event JSON Payload</span>
                <Code className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" />
              </label>
              <textarea
                value={simPayload}
                onChange={(e) => setSimPayload(e.target.value)}
                rows={7}
                className="w-full bg-stone-50 dark:bg-black/60 border border-stone-300 dark:border-zinc-800 rounded-xl p-3 text-xs font-mono text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-orange-500 resize-none selection:bg-orange-500/30"
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-zinc-800/80">
            <button
              onClick={handleSimulateEvent}
              disabled={simulating}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-950/40 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {simulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting Event...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Emit Event to Pipeline
                </>
              )}
            </button>

            {/* Result Box */}
            {simulationResult && (
              <div className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-zinc-900/80 border border-stone-200 dark:border-zinc-800 text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4" /> {simulationResult.message}
                </div>
                <div className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-0.5">
                  <div>Event ID: {simulationResult.eventId}</div>
                  <div>Matched Rules: {simulationResult.result?.matchedRuleCount ?? 0}</div>
                  {simulationResult.result?.triggeredJobIds?.length > 0 && (
                    <div className="text-orange-600 dark:text-orange-400 truncate">
                      Jobs: {simulationResult.result.triggeredJobIds.join(', ')}
                    </div>
                  )}
                  {simulationResult.result?.triggeredWorkflowIds?.length > 0 && (
                    <div className="text-purple-600 dark:text-purple-400 truncate">
                      Workflows: {simulationResult.result.triggeredWorkflowIds.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Event Subscriptions & Trigger Rules (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Event Subscriptions & Trigger Rules</h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 font-mono text-stone-700 dark:text-zinc-400">
                {subscriptions.length} active rule{subscriptions.length === 1 ? '' : 's'}
              </span>
            </div>

            {subscriptions.length === 0 ? (
              <div className="py-12 text-center text-stone-500 dark:text-zinc-500">
                <Zap className="w-10 h-10 mx-auto text-stone-300 dark:text-zinc-700 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-stone-700 dark:text-zinc-400">No event subscriptions configured yet</p>
                <p className="text-[11px] text-stone-500 dark:text-zinc-600 mt-1 max-w-sm mx-auto">
                  Create a rule to automatically dispatch Jobs or DAG Workflows when specific event types occur.
                </p>
                <button
                  onClick={() => {
                    if (availableQueues.length === 0) {
                      ensureDefaultQueue();
                    }
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-white dark:text-zinc-200 border border-stone-800 dark:border-zinc-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-400" /> Create First Trigger
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`p-4 rounded-xl border transition-all ${
                      sub.enabled
                        ? 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/40 hover:border-stone-300 dark:hover:border-zinc-700'
                        : 'border-stone-200 dark:border-zinc-800/40 bg-stone-100/50 dark:bg-zinc-950/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100">{sub.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                              sub.targetType === 'WORKFLOW'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                            }`}
                          >
                            {sub.targetType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-mono text-orange-600 dark:text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                            {sub.eventType}
                          </span>
                          {sub.targetType === 'JOB' && sub.queue && (
                            <span className="text-[11px] text-stone-600 dark:text-zinc-400 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-stone-400 dark:text-zinc-500" /> {sub.queue.name} ({sub.jobType || 'default'})
                            </span>
                          )}
                          {sub.targetType === 'WORKFLOW' && (
                            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                              DAG Pipeline
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleSub(sub)}
                          className="p-1 text-stone-400 dark:text-zinc-400 hover:text-orange-500 transition-colors"
                          title={sub.enabled ? 'Disable Trigger' : 'Enable Trigger'}
                        >
                          {sub.enabled ? (
                            <ToggleRight className="w-5 h-5 text-orange-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-stone-400 dark:text-zinc-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSub(sub.id)}
                          className="p-1 text-stone-400 dark:text-zinc-500 hover:text-rose-500 transition-colors"
                          title="Delete Trigger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Webhook Endpoint helper */}
                    <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-stone-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                        <Webhook className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500 shrink-0" />
                        <span className="truncate">/api/v1/events/webhook/{sub.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.secret && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-3 h-3" /> HMAC Secured
                          </span>
                        )}
                        <button
                          onClick={() => copyWebhookUrl(sub.id)}
                          className="px-2 py-1 bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 rounded text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedId === sub.id ? 'Copied!' : 'Copy URL'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Real-Time Event Audit Stream */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Live Ingested Event Stream & Audit Trail</h3>
          </div>
          <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-500">Auto-refreshing via Telemetry</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No events recorded yet. Use the Interactive Sandbox above to emit events.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Event Type</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Matched Rules</th>
                  <th className="pb-2">Triggered Output</th>
                  <th className="pb-2">Payload Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-2.5 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 font-mono font-bold text-orange-400">
                      {log.eventType}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {log.source}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          log.status === 'PROCESSED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'IGNORED'
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status === 'PROCESSED' && <CheckCircle2 className="w-3 h-3" />}
                        {log.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {log.status === 'IGNORED' && <AlertCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-300 font-mono">
                      {log.matchedRuleCount} rule{log.matchedRuleCount === 1 ? '' : 's'}
                    </td>
                    <td className="py-2.5 font-mono text-[11px]">
                      {log.triggeredJobIds && log.triggeredJobIds.length > 0 && (
                        <span className="text-emerald-400">
                          {log.triggeredJobIds.length} Job(s)
                        </span>
                      )}
                      {log.triggeredWorkflowIds && log.triggeredWorkflowIds.length > 0 && (
                        <span className="text-purple-400 ml-1">
                          {log.triggeredWorkflowIds.length} DAG(s)
                        </span>
                      )}
                      {(!log.triggeredJobIds || log.triggeredJobIds.length === 0) &&
                        (!log.triggeredWorkflowIds || log.triggeredWorkflowIds.length === 0) && (
                          <span className="text-zinc-600">—</span>
                        )}
                    </td>
                    <td className="py-2.5 font-mono text-zinc-400 max-w-xs truncate" title={JSON.stringify(log.payload)}>
                      {JSON.stringify(log.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Event Trigger */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 text-stone-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" /> Create Event Trigger Rule
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-zinc-300 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Stripe Payment Workflow Trigger"
                  className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block mb-1">
                  Event Type Pattern (supports wildcards e.g. <code>payment.*</code>)
                </label>
                <input
                  type="text"
                  required
                  value={newSubEventType}
                  onChange={(e) => setNewSubEventType(e.target.value)}
                  placeholder="e.g. payment.success, order.*"
                  className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-orange-600 dark:text-orange-400 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block mb-1">Target Action</label>
                  <select
                    value={newSubTarget}
                    onChange={(e) => setNewSubTarget(e.target.value as any)}
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                  >
                    <option value="JOB">Single Job</option>
                    <option value="WORKFLOW">DAG Workflow Pipeline</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Target Queue</label>
                    {availableQueues.length === 0 && (
                      <button
                        type="button"
                        onClick={ensureDefaultQueue}
                        disabled={creatingQueue}
                        className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <PlusCircle className="w-3 h-3" /> {creatingQueue ? 'Creating...' : 'Create Queue'}
                      </button>
                    )}
                  </div>
                  {availableQueues.length === 0 ? (
                    <div className="w-full bg-amber-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                      <span>No queues available</span>
                      <button
                        type="button"
                        onClick={ensureDefaultQueue}
                        disabled={creatingQueue}
                        className="px-2 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-bold"
                      >
                        {creatingQueue ? 'Creating...' : '+ Create Default Queue'}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedQueueId || availableQueues[0]?.id || ''}
                      onChange={(e) => setSelectedQueueId(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                    >
                      {availableQueues.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name} (Priority {q.priority || 10})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {newSubTarget === 'JOB' && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block mb-1">Job Handler Type</label>
                  <select
                    value={newSubJobType}
                    onChange={(e) => setNewSubJobType(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                  >
                    <option value="email_notification">Email Notification</option>
                    <option value="report_generation">Report Generation</option>
                    <option value="webhook_delivery">Webhook Delivery</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block mb-1">
                  Optional HMAC Webhook Secret (Leave empty for public API)
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={newSubSecret}
                    onChange={(e) => setNewSubSecret(e.target.value)}
                    placeholder="e.g. whsec_super_secret_key"
                    className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-stone-900 dark:text-zinc-300 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={availableQueues.length === 0}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Create Trigger Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
