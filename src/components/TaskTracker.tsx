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
      if (isExecuting) return;

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

      setIsExecuting(true);
      const step = currentSteps[activeIdx];

      if (step.status === "pending") {
        setCurrentSteps((prev) => {
          const next = [...prev];
          next[activeIdx] = { ...step, status: "active" };
          return next;
        });
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
          setCurrentSteps((prev) => {
            const next = [...prev];
            next[activeIdx] = { ...step, status: "error" };
            return next;
          });
          setIsExecuting(false);
          return;
        }

        if (isCancelled) return;

        const delay = step.delayMs ?? 1500;
        if (delay > 0) {
          await new Promise((res) => setTimeout(res, delay));
        }

        if (isCancelled) return;

        setCurrentSteps((prev) => {
          const next = [...prev];
          next[activeIdx] = { ...step, status: "done" };
          return next;
        });
        setIsExecuting(false);
      }
    };

    processSteps();

    return () => {
      isCancelled = true;
    };
  }, [currentSteps, isExecuting]);

  // If it's a simple 1-step task, don't show the tracker per user request
  if (!goal || currentSteps.length <= 1) return null;

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
      // Sleek, thin horizontal pill
      className="fixed top-[env(safe-area-inset-top,1rem)] left-1/2 -translate-x-1/2 mt-4 z-[100] w-[90vw] max-w-lg bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full cursor-grab active:cursor-grabbing overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 gap-3 pointer-events-auto">
        <div className="flex items-center gap-3 overflow-hidden flex-1 pointer-events-none">
          <Activity
            size={16}
            className="text-blue-400 shrink-0 animate-pulse"
          />
          <div className="flex flex-col overflow-hidden">
            <span
              className="text-white/60 text-[10px] font-bold uppercase tracking-wider truncate mb-0.5"
              title={goal}
            >
              {goal}
            </span>
            <span className="text-blue-100 text-xs font-medium truncate flex items-center gap-2">
              {activeStepItem?.status === "active" && (
                <Loader2
                  size={12}
                  className="shrink-0 animate-spin text-blue-400"
                />
              )}
              {activeStepItem?.status === "done" && (
                <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />
              )}
              {activeStepItem?.status === "pending" && (
                <Circle size={12} className="shrink-0 text-slate-500" />
              )}
              {activeStepItem?.status === "error" && (
                <X size={12} className="shrink-0 text-red-500" />
              )}
              {activeStepItem?.name || "Processing..."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-3">
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
    </motion.div>
  );
};
