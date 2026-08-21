import React, { useState, useEffect } from 'react';
import { X, Send, Zap, AlertCircle } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface CreateJobModalProps {
  queues: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ queues: initialQueues, onClose, onSuccess }) => {
  const [queuesList, setQueuesList] = useState<Array<{ id: string; name: string }>>(initialQueues);
  const [queueId, setQueueId] = useState<string>(initialQueues[0]?.id || '');
  const [jobType, setJobType] = useState<string>('email_notification');
  const [priority, setPriority] = useState<number>(20);
  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify({ to: 'user@example.com', subject: 'Dashboard Test Notification', template: 'welcome' }, null, 2)
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadQueues() {
      try {
        const res = await fetchApi<{ queues: Array<{ id: string; name: string }> }>('/queues');
        if (res.queues && res.queues.length > 0) {
          setQueuesList(res.queues);
          if (!queueId) {
            setQueueId(res.queues[0].id);
          }
        }
      } catch (err) {
        console.error('Failed loading queues for modal:', err);
      }
    }
    loadQueues();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetQueueId = queueId || queuesList[0]?.id;
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

      await fetchApi('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          queueId: targetQueueId,
          type: jobType,
          payload: parsedPayload,
          priority: Number(priority),
        }),
      });

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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" /> Ingest New Background Test Job
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Target Queue</label>
            <select
              value={queueId || queuesList[0]?.id || ''}
              onChange={(e) => setQueueId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {queuesList.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
              {queuesList.length === 0 && (
                <option value="">No queues available</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Job Handler Type</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {['email_notification', 'report_generation', 'webhook_delivery', 'failure_demo'].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all ${
                    jobType === type
                      ? 'bg-brand-600/20 text-brand-400 border-brand-500/50 shadow-inner'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Priority (1 - 100)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Payload (JSON)</label>
            <textarea
              rows={4}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-brand-500 shadow-inner"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-500/20 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Ingesting...' : 'Ingest Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
