import { motion } from "motion/react";

export function WaveformAnimation({ active, color = "#3B82F6" }: { active: boolean; color?: string }) {
  const bars = [1, 2, 3, 4, 5, 6, 7, 8];
  
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {bars.map((bar) => (
        <motion.div
          key={bar}
          animate={{
            height: active ? [4, 24, 12, 32, 8] : 4,
            opacity: active ? [0.4, 1, 0.6] : 0.4
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: bar * 0.05,
            ease: "easeInOut"
          }}
          className="w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
