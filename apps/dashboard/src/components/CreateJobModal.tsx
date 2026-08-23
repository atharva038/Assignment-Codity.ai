import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Zap, AlertCircle, Plus, Clock, Repeat, Calendar } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface QueueItem {
  id: string;
  name: string;
  projectId?: string;
  project?: { id: string; name: string };
}

interface CreateJobModalProps {
  queues: Array<{ id: string; name: string; projectId?: string; project?: { id: string; name: string } }>;
  onClose: () => void;
  onSuccess: () => void;
}

type JobScheduleMode = 'IMMEDIATE' | 'DELAYED' | 'RECURRING_CRON';

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ queues: initialQueues, onClose, onSuccess }) => {
  const [queuesList, setQueuesList] = useState<QueueItem[]>(initialQueues);
  const [queueId, setQueueId] = useState<string>(initialQueues[0]?.id || '');
  const [scheduleMode, setScheduleMode] = useState<JobScheduleMode>('IMMEDIATE');
  const [jobType, setJobType] = useState<string>('email_notification');
  const [cronJobName, setCronJobName] = useState<string>('Periodic Background Sync');
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');
  const [delaySeconds, setDelaySeconds] = useState<number>(30);
  const [priority, setPriority] = useState<number>(20);
  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify({ to: 'user@example.com', subject: 'Dashboard Test Notification', template: 'welcome' }, null, 2)
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [creatingDefaultQueue, setCreatingDefaultQueue] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadQueues = async () => {
    try {
      const res = await fetchApi<{ queues: QueueItem[] }>('/queues');
      if (res.queues && res.queues.length > 0) {
        setQueuesList(res.queues);
        if (!queueId || !res.queues.some((q) => q.id === queueId)) {
          setQueueId(res.queues[0].id);
        }
      } else {
        setQueuesList([]);
        setQueueId('');
      }
    } catch (err) {
      console.error('Failed loading queues for modal:', err);
    }
  };

  useEffect(() => {
    loadQueues();
  }, []);

  const handleQuickCreateQueue = async () => {
    setCreatingDefaultQueue(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi<{ message: string; queue: QueueItem }>('/queues', {
        method: 'POST',
        body: JSON.stringify({
          name: 'default-task-queue',
          priority: 20,
          concurrencyLimit: 5,
        }),
      });
      if (res.queue) {
        setQueuesList([res.queue]);
        setQueueId(res.queue.id);
        await loadQueues();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to auto-create queue');
    } finally {
      setCreatingDefaultQueue(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const selectedQueue = queuesList.find((q) => q.id === queueId) || queuesList[0];
    const targetQueueId = selectedQueue?.id;

    if (!targetQueueId) {
      setErrorMsg('No target queue selected. Please create a queue first.');
      return;
    }

    setSubmitting(true);

    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(payloadJson);
      } catch {
        setErrorMsg('Invalid JSON format in payload field');
        setSubmitting(false);
        return;
      }

      if (scheduleMode === 'RECURRING_CRON') {
        const targetProjectId = selectedQueue.project?.id || selectedQueue.projectId;
        if (!targetProjectId) {
          setErrorMsg('Unable to determine project ID for target queue');
          setSubmitting(false);
          return;
        }

        await fetchApi('/scheduled-jobs', {
          method: 'POST',
          body: JSON.stringify({
            projectId: targetProjectId,
            queueId: targetQueueId,
            name: cronJobName.trim() || `${jobType}-cron`,
            cronExpression: cronExpression.trim(),
            jobType,
            payload: parsedPayload,
            priority: Number(priority),
            enabled: true,
          }),
        });
      } else {
        const availableAt =
          scheduleMode === 'DELAYED'
            ? new Date(Date.now() + Math.max(1, delaySeconds) * 1000).toISOString()
            : undefined;

        await fetchApi('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            queueId: targetQueueId,
            type: jobType,
            payload: parsedPayload,
            priority: Number(priority),
            availableAt,
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting test job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeSelect = (type: string) => {
    setJobType(type);
    if (type === 'email_notification') {
      setPayloadJson(JSON.stringify({ to: 'demo@example.com', subject: 'Live Dashboard Test', template: 'welcome' }, null, 2));
    } else if (type === 'report_generation') {
      setPayloadJson(JSON.stringify({ reportType: 'MONTHLY_METRICS', format: 'PDF' }, null, 2));
    } else if (type === 'webhook_delivery') {
      setPayloadJson(JSON.stringify({ url: 'https://webhook.site/test', event: 'user.signup' }, null, 2));
    } else if (type === 'failure_demo') {
      setPayloadJson(JSON.stringify({ errorMessage: 'Simulated handler crash for retry testing' }, null, 2));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> Ingest & Schedule Jobs
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Create immediate, delayed, or recurring cron jobs
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Schedule Mode Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setScheduleMode('IMMEDIATE')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              scheduleMode === 'IMMEDIATE'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Immediate
          </button>
          <button
            type="button"
            onClick={() => setScheduleMode('DELAYED')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              scheduleMode === 'DELAYED'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Delayed
          </button>
          <button
            type="button"
            onClick={() => setScheduleMode('RECURRING_CRON')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              scheduleMode === 'RECURRING_CRON'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" /> Recurring (Cron)
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-bold mb-1.5 uppercase text-[10px] tracking-wider">Target Queue</label>
            {queuesList.length > 0 ? (
              <select
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-orange-500 font-semibold"
              >
                {queuesList.map((q) => (
                  <option key={q.id} value={q.id}>
                    ⚡ {q.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    No queues found in this workspace
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                    Required
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Background jobs require a target queue for worker processing and priority routing.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleQuickCreateQueue}
                    disabled={creatingDefaultQueue}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-[11px] flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {creatingDefaultQueue ? 'Provisioning Queue...' : 'Create "default-task-queue" Now'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Delayed Options */}
          {scheduleMode === 'DELAYED' && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2">
              <label className="block text-amber-300 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Execution Delay (Seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={86400}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-32 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-zinc-400 text-[11px]">
                  Job will remain <code className="text-amber-400 font-mono">SCHEDULED</code> until {delaySeconds}s pass, then promoted to <code className="text-emerald-400 font-mono">QUEUED</code>.
                </span>
              </div>
            </div>
          )}

          {/* Conditional Cron Options */}
          {scheduleMode === 'RECURRING_CRON' && (
            <div className="p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-3">
              <div>
                <label className="block text-purple-300 font-bold mb-1 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Cron Job Name
                </label>
                <input
                  type="text"
                  value={cronJobName}
                  onChange={(e) => setCronJobName(e.target.value)}
                  placeholder="e.g. Hourly DB Cleanup"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-medium text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-purple-300 font-bold mb-1.5 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" /> Cron Expression (5 fields)
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {[
                    { label: 'Every 1 min', expr: '*/1 * * * *' },
                    { label: 'Every 5 mins', expr: '*/5 * * * *' },
                    { label: 'Every hour', expr: '0 * * * *' },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.expr}
                      onClick={() => setCronExpression(p.expr)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
                        cronExpression === p.expr
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-purple-200 font-mono text-xs focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-zinc-400 font-bold mb-1.5 uppercase text-[10px] tracking-wider">Preset Job Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'email_notification', label: 'Email Task' },
                { id: 'report_generation', label: 'PDF Report' },
                { id: 'webhook_delivery', label: 'Webhook' },
                { id: 'failure_demo', label: 'Failure Demo' },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleTypeSelect(t.id)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    jobType === t.id
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 font-bold'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-bold mb-1.5 uppercase text-[10px] tracking-wider">Priority (1 = Highest, 50 = Normal)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-bold mb-1.5 uppercase text-[10px] tracking-wider">Payload (JSON)</label>
            <textarea
              rows={3}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || queuesList.length === 0}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                scheduleMode === 'RECURRING_CRON'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-purple-500/20'
                  : scheduleMode === 'DELAYED'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black shadow-amber-500/20'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20'
              }`}
            >
              <Send className="w-4 h-4" />{' '}
              {submitting
                ? 'Submitting...'
                : scheduleMode === 'RECURRING_CRON'
                ? 'Save Cron Schedule'
                : scheduleMode === 'DELAYED'
                ? 'Schedule Delayed Job'
                : 'Ingest Job'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

