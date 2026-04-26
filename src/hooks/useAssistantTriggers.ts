import { useEffect, useRef, useCallback } from "react";

interface AssistantTriggersProps {
  onTrigger: (type: "shake" | "native" | "voice") => void;
  shakeEnabled?: boolean;
  nativeEnabled?: boolean;
}

export function useAssistantTriggers({ onTrigger, shakeEnabled = true, nativeEnabled = true }: AssistantTriggersProps) {
  const shakeCount = useRef<number>(0);
  const lastShakeTime = useRef<number>(0);
  const lastTriggerTime = useRef<number>(0);
  
  // Refined thresholds
  const shakeThreshold = 28; // Increased for more deliberate shakes
  const doubleShakeWindow = 1200; // Time frame for the second shake
  const minTimeBetweenShakes = 300; // Prevent noise from counting as 2 shakes
  const triggerCooldown = 3000; 
  
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!shakeEnabled) return;
    
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    
    const { x, y, z } = acc;
    if (x === null || y === null || z === null) return;
    
    const acceleration = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    if (now - lastTriggerTime.current < triggerCooldown) return;

    if (acceleration > shakeThreshold) {
      const timeSinceLastShake = now - lastShakeTime.current;

      // Ignore if shakes are too close together (likely noise or part of the same first shake)
      if (timeSinceLastShake < minTimeBetweenShakes) return;

      if (timeSinceLastShake > doubleShakeWindow) {
        // First shake of a potential pair
        shakeCount.current = 1;
        lastShakeTime.current = now;
      } else {
        // Second shake within valid window
        shakeCount.current += 1;
        lastShakeTime.current = now;
        
        if (shakeCount.current >= 2) {
          lastTriggerTime.current = now;
          shakeCount.current = 0;
          onTrigger("shake");
        }
      }
    }
  }, [onTrigger, shakeEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.DeviceMotionEvent && shakeEnabled) {
      const requestPermission = async () => {
        try {
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            const response = await (DeviceMotionEvent as any).requestPermission();
            if (response === 'granted') {
              window.addEventListener("devicemotion", handleMotion);
            }
          } else {
            window.addEventListener("devicemotion", handleMotion);
          }
        } catch (e) {
          console.warn("DeviceMotion permission denied");
        }
      };

      requestPermission();
    }

    (window as any).triggerNativeAssistant = (type: string) => {
      if (nativeEnabled) {
        onTrigger("native");
      }
    };

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      delete (window as any).triggerNativeAssistant;
    };
  }, [handleMotion, shakeEnabled, nativeEnabled, onTrigger]);

  return {
    simulateDoubleShake: () => {
      if (shakeEnabled) onTrigger("shake");
    }
  };
}
