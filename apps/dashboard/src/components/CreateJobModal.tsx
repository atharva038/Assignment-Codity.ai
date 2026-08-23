import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" /> Ingest New Background Test Job
          </h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800">
            <X className="w-5 h-5" />
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
            <select
              value={queueId}
              onChange={(e) => setQueueId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-orange-500"
            >
              {queuesList.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

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
              rows={4}
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
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Ingesting...' : 'Ingest Job'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
