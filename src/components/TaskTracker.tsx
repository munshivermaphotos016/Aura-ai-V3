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
      className="fixed top-[env(safe-area-inset-top,0.5rem)] left-1/2 -translate-x-1/2 mt-2 z-[100] w-max max-w-[95vw] px-4 py-2.5 bg-black/80 backdrop-blur-3xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-full cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-between gap-3 pointer-events-auto"
    >
      <div className="flex items-center gap-2 overflow-hidden pointer-events-none flex-1">
        <Activity
          size={14}
          className="text-white shrink-0 animate-pulse"
        />
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <span
            className="text-white/95 text-[13px] font-medium tracking-wide truncate max-w-[150px] sm:max-w-[200px]"
            title={goal}
          >
            {goal}
          </span>
          {activeStepItem && (
            <span className="text-white/70 text-[12px] truncate flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3 shrink-0">
              {activeStepItem.status === "active" ? (
                <Loader2 size={12} className="animate-spin text-white/50 shrink-0" />
              ) : activeStepItem.status === "done" ? (
                <CheckCircle2 size={12} className="text-white/50 shrink-0" />
              ) : (
                <Circle size={10} className="text-white/30 shrink-0" />
              )}
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{activeStepItem.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-white/10 shrink-0">
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-full transition cursor-pointer"
            title="Cancel & Stop Task"
          >
            <Square size={12} className="fill-current opacity-80" />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
            title="Dismiss UI (Keep running)"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
};
