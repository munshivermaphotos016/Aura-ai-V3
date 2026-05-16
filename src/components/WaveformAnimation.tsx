import { motion } from "motion/react";

export function WaveformAnimation({ active }: { active: boolean }) {
  // Use a dense number of bars to simulate the smooth Google Assistant/Gemini wave
  const bars = Array.from({ length: 12 }, (_, i) => i);
  
  const getGradient = (index: number) => {
    // Exact Google colors: Blue, Red, Yellow, Green
    const colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
    return colors[index % colors.length];
  };
  
  return (
    <div className="flex items-center justify-center gap-[6px] h-16 w-full pointer-events-none">
      {bars.map((bar, i) => {
        const delay = Math.sin(i * 0.8) * 0.4;
        const waveColor = getGradient(i);
          
        return (
          <motion.div
            key={bar}
            initial={{ height: 4, opacity: 0 }}
            animate={{
              height: active ? [6, 15 + Math.random() * 25, 8 + Math.random() * 15, 20 + Math.random() * 20, 6] : 4,
              opacity: active ? [0.8, 1, 0.9] : 0
            }}
            transition={{
              duration: 1.0 + Math.random() * 0.3,
              repeat: Infinity,
              delay: delay,
              ease: "easeInOut"
            }}
            className="w-[5px] rounded-full"
            style={{ 
              backgroundColor: waveColor,
              boxShadow: active ? `0 0 10px ${waveColor}80` : "none",
              display: !active ? "none" : "block",
            }}
          />
        );
      })}
    </div>
  );
}
