import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  Workflow,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  RotateCcw,
  AlertTriangle,
  Code2,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Pause,
  Activity,
  Server,
  Database,
  Terminal,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

interface DagNode {
  id: string;
  name: string;
  stage: number;
  parents: string[];
  inDegree: number;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'BLOCKED';
  color: string;
  description: string;
  icon: string;
}

export const DagWorkflowGraph: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-a');
  const [hasCycleError, setHasCycleError] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  // Initial DAG nodes definition
  const initialNodes: DagNode[] = [
    {
      id: 'node-a',
      name: 'Step A: Ingest Customer Dataset',
      stage: 1,
      parents: [],
      inDegree: 0,
      status: 'QUEUED',
      color: '#3b82f6',
      description: 'Reads raw batch input payload from Webhook / Ingress and creates parent execution lock.',
      icon: '📦',
    },
    {
      id: 'node-b1',
      name: 'Step B1: Clean & Validate Schema',
      stage: 2,
      parents: ['node-a'],
      inDegree: 1,
      status: 'BLOCKED',
      color: '#8b5cf6',
      description: 'Zod schema validation and PII data sanitization in parallel worker thread #1.',
      icon: '⚙️',
    },
    {
      id: 'node-b2',
      name: 'Step B2: AI Feature Extraction',
      stage: 2,
      parents: ['node-a'],
      inDegree: 1,
      status: 'BLOCKED',
      color: '#ec4899',
      description: 'Calls embedding API to extract high-dimensional semantic feature vectors.',
      icon: '🧠',
    },
    {
      id: 'node-b3',
      name: 'Step B3: Image Asset Processing',
      stage: 2,
      parents: ['node-a'],
      inDegree: 1,
      status: 'BLOCKED',
      color: '#f59e0b',
      description: 'Resizes, compresses, and generates WebP image thumbnails for CDN caching.',
      icon: '🖼️',
    },
    {
      id: 'node-c',
      name: 'Step C: Fan-In Report Aggregation',
      stage: 3,
      parents: ['node-b1', 'node-b2', 'node-b3'],
      inDegree: 3,
      status: 'BLOCKED',
      color: '#10b981',
      description: 'Barrier synchronization: Waits for all 3 parallel tasks to conclude before generating summary PDF.',
      icon: '📑',
    },
    {
      id: 'node-d',
      name: 'Step D: Dispatch Webhook & Notify',
      stage: 4,
      parents: ['node-c'],
      inDegree: 1,
      status: 'BLOCKED',
      color: '#06b6d4',
      description: 'Signs HMAC-SHA256 signature and POSTs completed result to subscriber endpoint.',
      icon: '🚀',
    },
  ];

  // Auto-play stepper
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 5);
    }, 2800);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Compute state based on step
  const getStepState = (step: number): { nodes: DagNode[]; activeInDegrees: Record<string, number>; logMessage: string } => {
    const inDegrees: Record<string, number> = {
      'node-a': 0,
      'node-b1': 1,
      'node-b2': 1,
      'node-b3': 1,
      'node-c': 3,
      'node-d': 1,
    };

    const computedNodes = initialNodes.map((n) => ({ ...n }));

    if (step === 0) {
      return {
        nodes: computedNodes,
        activeInDegrees: inDegrees,
        logMessage: "Stage 1 (Initial): Root 'Step A' has in-degree=0 and status=QUEUED. All downstream child jobs are BLOCKED.",
      };
    } else if (step === 1) {
      computedNodes[0].status = 'COMPLETED';
      computedNodes[1].status = 'RUNNING';
      computedNodes[2].status = 'RUNNING';
      computedNodes[3].status = 'RUNNING';
      inDegrees['node-b1'] = 0;
      inDegrees['node-b2'] = 0;
      inDegrees['node-b3'] = 0;
      return {
        nodes: computedNodes,
        activeInDegrees: inDegrees,
        logMessage: "Stage 2 (Fan-Out): Step A completed. Decremented in-degrees for B1, B2, B3 to 0. Unlocked all 3 parallel tasks to RUNNING.",
      };
    } else if (step === 2) {
      computedNodes[0].status = 'COMPLETED';
      computedNodes[1].status = 'COMPLETED';
      computedNodes[2].status = 'COMPLETED';
      computedNodes[3].status = 'COMPLETED';
      computedNodes[4].status = 'RUNNING';
      inDegrees['node-b1'] = 0;
      inDegrees['node-b2'] = 0;
      inDegrees['node-b3'] = 0;
      inDegrees['node-c'] = 0;
      return {
        nodes: computedNodes,
        activeInDegrees: inDegrees,
        logMessage: "Stage 3 (Fan-In Barrier): B1, B2, and B3 finished. Step C unresolvedParentCount hit 0. Aggregator is now RUNNING.",
      };
    } else if (step === 3) {
      computedNodes[0].status = 'COMPLETED';
      computedNodes[1].status = 'COMPLETED';
      computedNodes[2].status = 'COMPLETED';
      computedNodes[3].status = 'COMPLETED';
      computedNodes[4].status = 'COMPLETED';
      computedNodes[5].status = 'RUNNING';
      inDegrees['node-c'] = 0;
      inDegrees['node-d'] = 0;
      return {
        nodes: computedNodes,
        activeInDegrees: inDegrees,
        logMessage: "Stage 4 (Terminal Webhook): Step C finished. In-degree for Step D decremented to 0. Webhook dispatcher is RUNNING.",
      };
    } else {
      computedNodes.forEach((n) => (n.status = 'COMPLETED'));
      Object.keys(inDegrees).forEach((k) => (inDegrees[k] = 0));
      return {
        nodes: computedNodes,
        activeInDegrees: inDegrees,
        logMessage: "Workflow Completed: All 6 stages resolved in topological Kahn order with zero lock contention and 100% data integrity.",
      };
    }
  };

  const { nodes, activeInDegrees, logMessage } = getStepState(currentStep);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const triggerCycleTest = () => {
    setHasCycleError(true);
    setTimeout(() => setHasCycleError(false), 4000);
  };

  // Node position map (viewBox 0 0 960 420)
  const nodeLayout = {
    'node-a': { x: 30, y: 160, w: 160, h: 80, outX: 190, outY: 200, inX: 30, inY: 200 },
    'node-b1': { x: 320, y: 40, w: 160, h: 80, outX: 480, outY: 80, inX: 320, inY: 80 },
    'node-b2': { x: 320, y: 160, w: 160, h: 80, outX: 480, outY: 200, inX: 320, inY: 200 },
    'node-b3': { x: 320, y: 280, w: 160, h: 80, outX: 480, outY: 320, inX: 320, inY: 320 },
    'node-c': { x: 610, y: 160, w: 160, h: 80, outX: 770, outY: 200, inX: 610, inY: 200 },
    'node-d': { x: 840, y: 160, w: 100, h: 80, outX: 940, outY: 200, inX: 840, inY: 200 },
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Workflow className="w-3.5 h-3.5" />
            Topological Sort • Animated Kahn's In-Degree Resolution
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 dark:text-zinc-100 tracking-tight">
            DAG Workflow Orchestration & Dependency Engine
          </h2>
          <p className="text-xs text-stone-600 dark:text-zinc-400 max-w-2xl mt-1 leading-relaxed">
            Multi-stage Directed Acyclic Graph (DAG) with parallel Fan-Out branch execution, particle stream telemetry, and atomic Fan-In barrier synchronization.
          </p>
        </div>

        {/* Stepper Controls */}
        <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-stone-200 border-stone-300'
        }`}>
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isAutoPlaying
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : isDark ? 'bg-zinc-800 text-zinc-300 hover:text-white' : 'bg-stone-100 text-stone-800 hover:bg-stone-300'
            }`}
          >
            {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isAutoPlaying ? 'Pause Auto' : 'Auto Play'}
          </button>

          <button
            onClick={() => setCurrentStep((prev) => (prev + 1) % 5)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5" /> Step Forward ({currentStep + 1}/5)
          </button>

          <button
            onClick={() => setCurrentStep(0)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              isDark ? 'bg-zinc-800 text-zinc-300 hover:text-white' : 'bg-stone-100 text-stone-800 hover:bg-stone-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={triggerCycleTest}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Test Cycle Rejection
          </button>
        </div>
      </div>

      {/* Cycle Detection Alert Popup */}
      {hasCycleError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500 text-rose-950 dark:text-rose-200 text-xs flex items-center gap-3 animate-in shake duration-300 shadow-xl">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <span className="font-bold">Kahn's Cycle Detection Rejection: </span>
            A circular back-edge dependency (<code className="font-mono bg-black/20 px-1 rounded">Step D → Step A</code>) was detected! Circular dependencies are rejected at submission with <code className="font-mono font-bold">HTTP 400 DAG_CYCLE_DETECTED</code>.
          </div>
        </div>
      )}

      {/* Live Pipeline State Message */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 text-xs ${
        isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' : 'bg-stone-50 border-stone-200 text-stone-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-mono font-bold text-stone-950 dark:text-zinc-100">{logMessage}</span>
        </div>
        <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold shrink-0">
          Stage {currentStep === 4 ? 'Complete' : `${currentStep + 1} of 4`}
        </div>
      </div>

      {/* SVG DAG TOPOLOGICAL CANVAS */}
      <div className={`rounded-3xl border shadow-xl overflow-hidden ${
        isDark ? 'bg-[#08090d] border-zinc-800' : 'bg-[#FAF8F5] border-[#D9D3C7]'
      }`}>
        <div className="p-4 sm:p-6 overflow-x-auto select-none">
          <svg viewBox="0 0 960 420" className="w-full min-w-[850px] h-auto font-sans">
            <defs>
              {/* Particle and Glow Filters */}
              <filter id="dag-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <filter id="particle-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Linear Gradients for Smooth Bezier Connectors */}
              <linearGradient id="grad-a-b1" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>

              <linearGradient id="grad-a-b2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>

              <linearGradient id="grad-a-b3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>

              <linearGradient id="grad-b1-c" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <linearGradient id="grad-b2-c" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <linearGradient id="grad-b3-c" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <linearGradient id="grad-c-d" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>

              {/* Arrow Markers */}
              <marker id="arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#8b5cf6" />
              </marker>
              <marker id="arrow-pink" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#ec4899" />
              </marker>
              <marker id="arrow-amber" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-emerald" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#10b981" />
              </marker>
              <marker id="arrow-cyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#06b6d4" />
              </marker>

              {/* Background Grid Pattern */}
              <pattern id="dag-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="14" cy="14" r="1.2" fill={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)'} />
              </pattern>
            </defs>

            <rect width="960" height="420" fill="url(#dag-grid-pattern)" />

            {/* STAGE COLUMNS INDICATORS */}
            <text x="110" y="24" fill={isDark ? '#71717a' : '#a8a29e'} fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">STAGE 1: ROOT</text>
            <text x="400" y="24" fill={isDark ? '#71717a' : '#a8a29e'} fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">STAGE 2: PARALLEL FAN-OUT (3x)</text>
            <text x="690" y="24" fill={isDark ? '#71717a' : '#a8a29e'} fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">STAGE 3: FAN-IN BARRIER</text>
            <text x="890" y="24" fill={isDark ? '#71717a' : '#a8a29e'} fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">STAGE 4: NOTIFY</text>

            {/* CUBIC BEZIER CONNECTORS (Curved Lines) */}
            {/* Step A -> B1 */}
            <path
              id="edge-a-b1"
              d="M 190 200 C 255 200, 255 80, 320 80"
              fill="none"
              stroke="url(#grad-a-b1)"
              strokeWidth={currentStep >= 1 ? '3' : '1.8'}
              strokeDasharray={currentStep === 1 ? '6 4' : undefined}
              className={currentStep === 1 ? 'animate-dash' : ''}
              opacity={currentStep >= 1 ? '1' : '0.35'}
              markerEnd="url(#arrow-purple)"
            />

            {/* Step A -> B2 */}
            <path
              id="edge-a-b2"
              d="M 190 200 C 255 200, 255 200, 320 200"
              fill="none"
              stroke="url(#grad-a-b2)"
              strokeWidth={currentStep >= 1 ? '3' : '1.8'}
              strokeDasharray={currentStep === 1 ? '6 4' : undefined}
              className={currentStep === 1 ? 'animate-dash' : ''}
              opacity={currentStep >= 1 ? '1' : '0.35'}
              markerEnd="url(#arrow-pink)"
            />

            {/* Step A -> B3 */}
            <path
              id="edge-a-b3"
              d="M 190 200 C 255 200, 255 320, 320 320"
              fill="none"
              stroke="url(#grad-a-b3)"
              strokeWidth={currentStep >= 1 ? '3' : '1.8'}
              strokeDasharray={currentStep === 1 ? '6 4' : undefined}
              className={currentStep === 1 ? 'animate-dash' : ''}
              opacity={currentStep >= 1 ? '1' : '0.35'}
              markerEnd="url(#arrow-amber)"
            />

            {/* Step B1 -> C */}
            <path
              id="edge-b1-c"
              d="M 480 80 C 545 80, 545 200, 610 200"
              fill="none"
              stroke="url(#grad-b1-c)"
              strokeWidth={currentStep >= 2 ? '3' : '1.8'}
              strokeDasharray={currentStep === 2 ? '6 4' : undefined}
              className={currentStep === 2 ? 'animate-dash' : ''}
              opacity={currentStep >= 2 ? '1' : '0.35'}
              markerEnd="url(#arrow-emerald)"
            />

            {/* Step B2 -> C */}
            <path
              id="edge-b2-c"
              d="M 480 200 C 545 200, 545 200, 610 200"
              fill="none"
              stroke="url(#grad-b2-c)"
              strokeWidth={currentStep >= 2 ? '3' : '1.8'}
              strokeDasharray={currentStep === 2 ? '6 4' : undefined}
              className={currentStep === 2 ? 'animate-dash' : ''}
              opacity={currentStep >= 2 ? '1' : '0.35'}
              markerEnd="url(#arrow-emerald)"
            />

            {/* Step B3 -> C */}
            <path
              id="edge-b3-c"
              d="M 480 320 C 545 320, 545 200, 610 200"
              fill="none"
              stroke="url(#grad-b3-c)"
              strokeWidth={currentStep >= 2 ? '3' : '1.8'}
              strokeDasharray={currentStep === 2 ? '6 4' : undefined}
              className={currentStep === 2 ? 'animate-dash' : ''}
              opacity={currentStep >= 2 ? '1' : '0.35'}
              markerEnd="url(#arrow-emerald)"
            />

            {/* Step C -> D */}
            <path
              id="edge-c-d"
              d="M 770 200 C 805 200, 805 200, 840 200"
              fill="none"
              stroke="url(#grad-c-d)"
              strokeWidth={currentStep >= 3 ? '3.2' : '1.8'}
              strokeDasharray={currentStep === 3 ? '6 4' : undefined}
              className={currentStep === 3 ? 'animate-dash' : ''}
              opacity={currentStep >= 3 ? '1' : '0.35'}
              markerEnd="url(#arrow-cyan)"
            />

            {/* ANIMATED GLOWING DATA PARTICLES (Moving along Bezier paths) */}
            {currentStep >= 1 && (
              <>
                <circle r="4" fill="#c084fc" filter="url(#particle-glow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M 190 200 C 255 200, 255 80, 320 80" />
                </circle>
                <circle r="4" fill="#f472b6" filter="url(#particle-glow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M 190 200 C 255 200, 255 200, 320 200" />
                </circle>
                <circle r="4" fill="#fbbf24" filter="url(#particle-glow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M 190 200 C 255 200, 255 320, 320 320" />
                </circle>
              </>
            )}

            {currentStep >= 2 && (
              <>
                <circle r="4.5" fill="#34d399" filter="url(#particle-glow)">
                  <animateMotion dur="2.0s" repeatCount="indefinite" path="M 480 80 C 545 80, 545 200, 610 200" />
                </circle>
                <circle r="4.5" fill="#34d399" filter="url(#particle-glow)">
                  <animateMotion dur="2.0s" repeatCount="indefinite" path="M 480 200 C 545 200, 545 200, 610 200" />
                </circle>
                <circle r="4.5" fill="#34d399" filter="url(#particle-glow)">
                  <animateMotion dur="2.0s" repeatCount="indefinite" path="M 480 320 C 545 320, 545 200, 610 200" />
                </circle>
              </>
            )}

            {currentStep >= 3 && (
              <circle r="5" fill="#22d3ee" filter="url(#particle-glow)">
                <animateMotion dur="1.4s" repeatCount="indefinite" path="M 770 200 C 805 200, 805 200, 840 200" />
              </circle>
            )}

            {/* PORT ANCHOR DOTS (Input & Output connection rings) */}
            {Object.entries(nodeLayout).map(([nodeKey, pos]) => (
              <g key={`ports-${nodeKey}`}>
                {/* Output port dot on right */}
                {nodeKey !== 'node-d' && (
                  <circle
                    cx={pos.outX}
                    cy={pos.outY}
                    r="4"
                    fill={isDark ? '#090a0f' : '#ffffff'}
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                )}
                {/* Input port dot on left */}
                {nodeKey !== 'node-a' && (
                  <circle
                    cx={pos.inX}
                    cy={pos.inY}
                    r="4"
                    fill={isDark ? '#090a0f' : '#ffffff'}
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                )}
              </g>
            ))}

            {/* DAG NODES */}
            {nodes.map((node) => {
              const pos = nodeLayout[node.id as keyof typeof nodeLayout];
              const isSelected = selectedNodeId === node.id;
              const isRunning = node.status === 'RUNNING';

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer transition-all duration-200"
                >
                  {/* Outer Pulsing Glow on Active/Selected Node */}
                  {(isSelected || isRunning) && (
                    <rect
                      x={pos.x - 3}
                      y={pos.y - 3}
                      width={pos.w + 6}
                      height={pos.h + 6}
                      rx="16"
                      fill="none"
                      stroke={isRunning ? '#a855f7' : '#3b82f6'}
                      strokeWidth="2"
                      opacity="0.8"
                      filter="url(#dag-glow)"
                      className={isRunning ? 'animate-pulse' : ''}
                    />
                  )}

                  {/* Main Node Card Body */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.w}
                    height={pos.h}
                    rx="14"
                    fill={
                      isDark
                        ? isSelected
                          ? '#151824'
                          : isRunning
                          ? '#19152b'
                          : '#0e1017'
                        : isSelected
                        ? '#eff6ff'
                        : '#FFFFFF'
                    }
                    stroke={
                      isSelected
                        ? isDark
                          ? '#60a5fa'
                          : '#2563eb'
                        : isRunning
                        ? '#a855f7'
                        : isDark
                        ? '#27272a'
                        : '#D9D3C7'
                    }
                    strokeWidth={isSelected ? '2.5' : isRunning ? '2' : '1.2'}
                  />

                  {/* Header Strip */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.w}
                    height="24"
                    rx="14"
                    fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                  />
                  <rect
                    x={pos.x}
                    y={pos.y + 14}
                    width={pos.w}
                    height="10"
                    fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                  />

                  {/* Node Title & Emoji */}
                  <text
                    x={pos.x + 12}
                    y={pos.y + 16}
                    fill={isDark ? '#f4f4f5' : '#18181b'}
                    fontSize="10.5"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    {node.icon} {node.id.toUpperCase()}
                  </text>

                  {/* In-Degree Counter Pill */}
                  <rect
                    x={pos.x + pos.w - 48}
                    y={pos.y + 4}
                    width="40"
                    height="16"
                    rx="6"
                    fill={activeInDegrees[node.id] === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
                    stroke={activeInDegrees[node.id] === 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}
                    strokeWidth="0.8"
                  />
                  <text
                    x={pos.x + pos.w - 28}
                    y={pos.y + 15}
                    fill={activeInDegrees[node.id] === 0 ? '#10b981' : '#f87171'}
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    IN:{activeInDegrees[node.id]}
                  </text>

                  {/* Task Subtitle */}
                  <text
                    x={pos.x + 12}
                    y={pos.y + 43}
                    fill={isDark ? '#e4e4e7' : '#27272a'}
                    fontSize="9.5"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {node.name.length > 22 ? `${node.name.substring(0, 20)}...` : node.name}
                  </text>

                  {/* Status Badge Indicator */}
                  <g transform={`translate(${pos.x + 12}, ${pos.y + 55})`}>
                    <circle
                      cx="4"
                      cy="4"
                      r="3.5"
                      fill={
                        node.status === 'COMPLETED'
                          ? '#10b981'
                          : node.status === 'RUNNING'
                          ? '#f59e0b'
                          : node.status === 'QUEUED'
                          ? '#3b82f6'
                          : '#71717a'
                      }
                      className={node.status === 'RUNNING' ? 'animate-ping' : ''}
                    />
                    <circle
                      cx="4"
                      cy="4"
                      r="3.5"
                      fill={
                        node.status === 'COMPLETED'
                          ? '#10b981'
                          : node.status === 'RUNNING'
                          ? '#f59e0b'
                          : node.status === 'QUEUED'
                          ? '#3b82f6'
                          : '#71717a'
                      }
                    />
                    <text
                      x="12"
                      y="7"
                      fill={
                        node.status === 'COMPLETED'
                          ? '#10b981'
                          : node.status === 'RUNNING'
                          ? '#f59e0b'
                          : node.status === 'QUEUED'
                          ? '#3b82f6'
                          : '#a1a1aa'
                      }
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {node.status}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SELECTED NODE INSPECTOR & INVARIANTS */}
      <div className={`rounded-3xl border shadow-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 ${
        isDark ? 'bg-[#0f1016] border-zinc-800' : 'bg-white border-stone-200'
      }`}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              DAG NODE INSPECTOR
            </span>
            <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">ID: {selectedNode.id}</span>
          </div>
          <h3 className="text-lg font-black text-stone-950 dark:text-zinc-100 flex items-center gap-2">
            <span>{selectedNode.icon}</span> {selectedNode.name}
          </h3>
          <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
            {selectedNode.description}
          </p>

          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-zinc-200 mb-2">
              Kahn's In-Degree Promotion SQL Logic
            </h4>
            <pre className="p-4 rounded-2xl bg-stone-950 text-purple-300 font-mono text-xs border border-stone-800 overflow-x-auto leading-relaxed shadow-inner">
              <code>{`-- 1. Decrement In-Degree Count on Parent Completion
UPDATE jobs 
SET unresolvedParentCount = unresolvedParentCount - 1
WHERE id IN (
  SELECT childJobId FROM job_dependencies 
  WHERE parentJobId = '${selectedNode.parents[0] || 'parent-uuid'}'
);

-- 2. Unlock to QUEUED when In-Degree reaches 0
UPDATE jobs 
SET status = 'QUEUED', availableAt = NOW()
WHERE workflowId = $workflowId 
  AND unresolvedParentCount = 0 
  AND status = 'BLOCKED';`}</code>
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border space-y-3 ${
            isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-stone-50 border-stone-200'
          }`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> DAG Orchestration Guarantees
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2 text-stone-800 dark:text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <span><strong>Cycle Immunity</strong>: Validates $O(V+E)$ topological sort order at workflow submission.</span>
              </li>
              <li className="flex items-start gap-2 text-stone-800 dark:text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <span><strong>Parallel Execution</strong>: Nodes at the same stage execute across separate worker nodes simultaneously.</span>
              </li>
              <li className="flex items-start gap-2 text-stone-800 dark:text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <span><strong>Cascading Failure Halting</strong>: If any parent fails permanently to DLQ, downstream child jobs are safely halted without partial execution leaks.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
