import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  Zap,
  Cpu,
  Layers,
  Search,
  GitMerge,
  AlertTriangle,
  Flame,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { TabType } from './Sidebar.js';

export interface TourStep {
  targetId: string;
  tab?: TabType;
  title: string;
  badge: string;
  description: string;
  technicalHighlight: string;
  icon: React.ReactNode;
  preferredPosition?: 'top' | 'bottom' | 'left' | 'right';
}

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenDemoLab?: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'sidebar-demo-lab',
    title: 'Interactive Demo Lab',
    badge: 'Evaluation Highlight',
    description:
      'The single best place to test all distributed systems features live! Features a built-in side-by-side drawer with 6 real-time simulation scenarios.',
    technicalHighlight:
      'Demonstrates PostgreSQL SKIP LOCKED atomic claiming, exponential backoff to DLQ, Kahn’s algorithm DAGs, Redis sliding window rate limits, AI diagnosis, and webhooks.',
    icon: <Flame className="w-5 h-5 text-orange-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'header-transport-toggle',
    title: 'Dual-Transport Live Streaming',
    badge: 'Zero-Lag Telemetry',
    description:
      'Seamlessly switch between High-Performance WebSockets and Adaptive REST Polling with real-time round-trip latency probes.',
    technicalHighlight:
      'WebSocket state updates stream at 60fps via Redis Pub/Sub backplane. If the socket disconnects, the client gracefully falls back to adaptive polling without dropping data.',
    icon: <Zap className="w-5 h-5 text-amber-400" />,
    preferredPosition: 'bottom',
  },
  {
    targetId: 'header-trigger-job',
    title: 'Transactional Ingestion & Deduplication',
    badge: 'Idempotency Engine',
    description:
      'Create single or batch tasks with priority levels, execution timeouts, custom JSON payloads, and idempotency keys.',
    technicalHighlight:
      'Ingests up to 100 jobs atomically per transaction. Computes SHA-256 idempotency key deduplication to guarantee strictly zero duplicate jobs.',
    icon: <Layers className="w-5 h-5 text-blue-400" />,
    preferredPosition: 'bottom',
  },
  {
    targetId: 'tab-overview',
    tab: 'overview',
    title: 'System Telemetry & Live Throughput',
    badge: 'Distributed Observability',
    description:
      'Real-time metrics dashboard tracking total completed tasks, failure rates, active worker fleet heartbeats, and live throughput graphs.',
    technicalHighlight:
      'Metrics aggregate across multi-tenant organizations with tenant data isolation and sub-millisecond Redis cache snapshots.',
    icon: <Compass className="w-5 h-5 text-orange-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'tab-queues',
    tab: 'queues',
    title: 'Multi-Queue Priority & Rate Limits',
    badge: 'Queue Orchestration',
    description:
      'Create and manage isolated priority queues with custom concurrency limits, sliding-window rate limiters, and pause/resume states.',
    technicalHighlight:
      'Queue state changes broadcast instantly across all worker instances. Paused queues immediately stop worker thread claims.',
    icon: <Cpu className="w-5 h-5 text-emerald-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'tab-jobs',
    tab: 'jobs',
    title: 'Job Explorer & Zero-HTTP Streaming',
    badge: 'State Machine & Logs',
    description:
      'Inspect detailed job lifecycles, execution attempt histories, worker thread assignment, and microsecond log streams.',
    technicalHighlight:
      'Table rows update live in-memory directly from WebSocket frames with zero HTTP polling spam, preserving 60fps browser UI fluidity.',
    icon: <Search className="w-5 h-5 text-cyan-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'tab-workflows',
    tab: 'workflows',
    title: 'DAG Workflow Orchestration',
    badge: 'Topological Engine',
    description:
      'Design and execute multi-stage Directed Acyclic Graph (DAG) pipelines with complex upstream/downstream parent dependencies.',
    technicalHighlight:
      'Uses Kahn’s Algorithm for topological sorting and cycle detection. Promotes child jobs from BLOCKED to QUEUED as parent dependencies resolve.',
    icon: <GitMerge className="w-5 h-5 text-indigo-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'tab-dlq',
    tab: 'dlq',
    title: 'Dead Letter Queue & AI Diagnosis',
    badge: 'Fault Tolerance & Self-Healing',
    description:
      'Quarantines permanently failed jobs with full stack traces, heuristic AI root-cause diagnosis, and atomic 1-click retry replay.',
    technicalHighlight:
      'Isolates poison-pill jobs to protect worker nodes. AI diagnostic engine classifies error signatures (e.g. Gateway 503, DB deadlocks).',
    icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
    preferredPosition: 'right',
  },
  {
    targetId: 'tab-sharding',
    tab: 'sharding',
    title: 'Consistent Hash Queue Sharding',
    badge: 'Horizontal Scalability',
    description:
      'Visualizes 16-virtual-node consistent hashing ring, distributing queue shards evenly across multiple distributed worker clusters.',
    technicalHighlight:
      'Uses MD5 virtual node mapping to minimize key reassignment during worker cluster scaling, guaranteeing uniform load distribution.',
    icon: <Radio className="w-5 h-5 text-purple-400" />,
    preferredPosition: 'right',
  },
];

export function InteractiveTour({ isOpen, onClose, onNavigateTab, onOpenDemoLab }: InteractiveTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const cardRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStepIndex];

  // Update target bounding box and position card smartly
  const updateSpotlight = useCallback(() => {
    if (!isOpen || !step) return;

    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      // Measure exact dimensions
      const cardEl = cardRef.current;
      const actualCardWidth = cardEl ? cardEl.offsetWidth : 420;
      const actualCardHeight = cardEl ? cardEl.offsetHeight : 360;
      const pad = 16;

      let top = rect.bottom + pad;
      let left = rect.left;

      // Position to the right of sidebar targets if space permits
      if (step.preferredPosition === 'right' && rect.right + actualCardWidth + pad < window.innerWidth) {
        left = rect.right + pad;
        // If target is near the bottom (like Demo Lab / Product Tour), align card upwards from target bottom
        if (rect.bottom + actualCardHeight > window.innerHeight) {
          top = Math.max(pad, rect.bottom - actualCardHeight);
        } else {
          top = Math.max(pad, rect.top);
        }
      } else if (top + actualCardHeight + pad > window.innerHeight) {
        // Place above target if bottom overflows
        top = Math.max(pad, rect.top - actualCardHeight - pad);
        left = Math.max(pad, Math.min(window.innerWidth - actualCardWidth - pad, rect.left));
      } else {
        left = Math.max(pad, Math.min(window.innerWidth - actualCardWidth - pad, left));
      }

      // Hard clamp safely within viewport bounds
      top = Math.max(pad, Math.min(window.innerHeight - actualCardHeight - pad, top));
      left = Math.max(pad, Math.min(window.innerWidth - actualCardWidth - pad, left));

      setCardPosition({ top, left });
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step]);

  // Navigate dashboard tab when step changes
  useEffect(() => {
    if (!isOpen || !step) return;

    if (step.tab) {
      onNavigateTab(step.tab);
    }

    const timer = setTimeout(() => {
      updateSpotlight();
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, currentStepIndex, step, onNavigateTab, updateSpotlight]);

  // Resize and scroll listener
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);

    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [isOpen, updateSpotlight]);

  // Keyboard navigation (Right: Next, Left: Back, Escape: Exit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem('scheduler_tour_completed', 'true');
    onClose();
  };

  const handleFinish = () => {
    localStorage.setItem('scheduler_tour_completed', 'true');
    onClose();
    if (onOpenDemoLab) {
      onOpenDemoLab();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] pointer-events-auto select-none">
      {/* 1. Backdrop Overlay with Cutout Spotlight */}
      <svg className="w-full h-full absolute inset-0 pointer-events-none transition-all duration-300">
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White background: full opacity */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout over target element: makes hole transparent */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark translucent backdrop applied with mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* 2. Glowing Neon Spotlight Ring around Target */}
      {targetRect && (
        <div
          className="absolute rounded-2xl pointer-events-none transition-all duration-300 ring-2 ring-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.4)] animate-pulse"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* 3. Floating Guided Walkthrough Card */}
      <div
        ref={cardRef}
        className="absolute z-[210] w-[calc(100vw-32px)] sm:w-[420px] max-h-[calc(100vh-32px)] overflow-y-auto no-scrollbar bg-zinc-950/95 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 flex flex-col space-y-4"
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
        }}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-48 h-20 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none blur-xl" />

        {/* Card Header: Step & Badge & Close */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              {step.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold text-orange-400 uppercase tracking-wider">
                  Step {currentStepIndex + 1} of {TOUR_STEPS.length}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {step.badge}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-zinc-100">{step.title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors"
            title="Exit Walkthrough (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body: Description & Technical Architecture Note */}
        <div className="space-y-3 relative z-10 text-xs">
          <p className="text-zinc-300 leading-relaxed text-xs">
            {step.description}
          </p>

          <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-1">
            <div className="text-[10px] font-mono font-bold text-orange-400 flex items-center gap-1 uppercase">
              <Sparkles className="w-3 h-3" /> Architecture & Viva Talking Point
            </div>
            <p className="text-[11px] text-zinc-200 leading-relaxed font-mono">
              {step.technicalHighlight}
            </p>
          </div>
        </div>

        {/* Progress Stepper Bar */}
        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Footer Actions: Back, Skip, Next */}
        <div className="flex items-center justify-between pt-1 relative z-10 text-xs">
          <button
            type="button"
            onClick={handleClose}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 font-semibold transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold flex items-center gap-1 shadow-lg shadow-orange-500/25 transition-all active:scale-95 cursor-pointer"
            >
              {currentStepIndex === TOUR_STEPS.length - 1 ? (
                <>
                  Start Demo Lab <Flame className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
