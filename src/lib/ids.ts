export function generateId() {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (e) {}
  
  // High-collision but safe fallback for non-secure contexts or older browsers
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
