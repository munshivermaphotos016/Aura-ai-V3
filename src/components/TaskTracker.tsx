import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  X,
  Square,
  Activity,
} from "lucide-react";

export interface TaskStep {
  name: string;
  status: "done" | "active" | "pending" | "error";
  action?: string;
  delayMs?: number;
}

export interface TaskTrackerProps {
  goal: string;
  steps: TaskStep[];
  onCancel?: () => void;
  onDismiss?: () => void;
  onComplete?: () => void;
  onExecuteAction?: (action: string) => Promise<void> | void;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({
  goal,
  steps: initialSteps,
  onCancel,
  onDismiss,
  onComplete,
  onExecuteAction,
}) => {
  const [currentSteps, setCurrentSteps] = useState<TaskStep[]>(() =>
    initialSteps.map((step) => ({ ...step, status: step.status || "pending" })),
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const isExecutingRef = React.useRef(false);

  // Web Audio Context for Beeps
  const playBeep = React.useCallback((type: "active" | "done" | "error") => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "active") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "done") {
        osc.type = "square";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const onCompleteRef = React.useRef(onComplete);
  const onExecuteActionRef = React.useRef(onExecuteAction);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onExecuteActionRef.current = onExecuteAction;
  }, [onComplete, onExecuteAction]);

  useEffect(() => {
    // Intelligently process step dependencies and actions
    let isCancelled = false;

    const processSteps = async () => {
      if (isExecutingRef.current) return;

      const activeIdx = currentSteps.findIndex(
        (s) => s.status === "pending" || s.status === "active",
      );
      if (activeIdx === -1) {
        if (onCompleteRef.current) {
          const timer = setTimeout(() => {
            if (!isCancelled && onCompleteRef.current) onCompleteRef.current();
          }, 1000);
          return () => clearTimeout(timer);
        }
        return;
      }

      isExecutingRef.current = true;
      setIsExecuting(true);
      const step = currentSteps[activeIdx];

      if (step.status === "pending") {
        playBeep("active");
        setCurrentSteps((prev) => {
          const next = [...prev];
          next[activeIdx] = { ...step, status: "active" };
          return next;
        });
        isExecutingRef.current = false;
        setIsExecuting(false);
        return;
      }

      if (step.status === "active") {
        try {
          if (step.action && onExecuteActionRef.current) {
            await onExecuteActionRef.current(step.action);
          }
        } catch (err) {
          console.error("Step failed:", err);
          playBeep("error");

          if (!isCancelled) {
            setCurrentSteps((prev) => {
              const next = [...prev];
              next[activeIdx] = { ...step, status: "error" };
              return next;
            });
          }
          isExecutingRef.current = false;
          setIsExecuting(false);
          return;
        }

        if (isCancelled) {
          isExecutingRef.current = false;
          setIsExecuting(false);
          return;
        }

        const delay = step.delayMs ?? 1500;
        if (delay > 0) {
          await new Promise((res) => setTimeout(res, delay));
        }

        if (isCancelled) {
          isExecutingRef.current = false;
          setIsExecuting(false);
          return;
        }

        playBeep("done");
        setCurrentSteps((prev) => {
          const next = [...prev];
          next[activeIdx] = { ...step, status: "done" };
          return next;
        });
        isExecutingRef.current = false;
        setIsExecuting(false);
      }
    };

    processSteps();

    return () => {
      isCancelled = true;
    };
  }, [currentSteps]);

  // If there is no goal, don't show the tracker
  if (!goal) return null;

  // Use the active step, or the first pending, or the last one if all done
  const activeStepItem =
    currentSteps.find((s) => s.status === "active") ||
    currentSteps.find((s) => s.status === "pending") ||
    currentSteps[currentSteps.length - 1];

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-[env(safe-area-inset-top,1rem)] left-1/2 -translate-x-1/2 mt-4 z-[100] w-[90vw] max-w-lg bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl cursor-grab active:cursor-grabbing overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 gap-3 pointer-events-auto border-b border-white/5">
        <div className="flex items-center gap-3 overflow-hidden flex-1 pointer-events-none">
          <Activity
            size={18}
            className="text-blue-400 shrink-0 animate-pulse"
          />
          <div className="flex flex-col overflow-hidden">
            <span
              className="text-white text-sm font-semibold truncate mb-0.5"
              title={goal}
            >
              {goal}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition cursor-pointer"
              title="Cancel & Stop Task"
            >
              <Square size={14} className="fill-current opacity-80" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              title="Dismiss UI (Keep running)"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col px-4 py-2 gap-1.5 max-h-48 overflow-y-auto">
        {currentSteps.map((step, idx) => (
          <div key={idx} className={`flex items-center gap-3 text-sm py-1 font-medium ${
            step.status === 'active' ? 'text-blue-100' : 
            step.status === 'done' ? 'text-slate-400' :
            step.status === 'error' ? 'text-red-300' :
            'text-slate-600'
          }`}>
            <span className="shrink-0 flex items-center justify-center w-5">
              {step.status === "active" && (
                <Loader2 size={14} className="animate-spin text-blue-400" />
              )}
              {step.status === "done" && (
                <CheckCircle2 size={14} className="text-emerald-400" />
              )}
              {step.status === "pending" && (
                <Circle size={14} className="text-slate-600" />
              )}
              {step.status === "error" && (
                <X size={14} className="text-red-500" />
              )}
            </span>
            <span className="truncate">{step.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
