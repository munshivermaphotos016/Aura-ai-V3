import { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { generateId } from './lib/ids';

// CRITICAL: Compatibility polyfill for environments where crypto.randomUUID is not available (e.g. Brave, Safari, non-secure contexts)
// We do this at the very top to ensure stability for all downstream imports.
if (typeof window !== 'undefined') {
  // Ensure we have a working crypto object
  if (!window.crypto) (window as any).crypto = {};
  
  // Polyfill randomUUID if missing (common in Brave/Safari over HTTP or Restricted environments)
  if (!(window.crypto as any).randomUUID) {
    (window.crypto as any).randomUUID = generateId;
    console.warn("Using fallback for crypto.randomUUID");
  }

  // Force body background to avoid "Black Screen" confusion before React paints
  document.body.style.backgroundColor = '#0F172A';
  
  // Create a silent indicator that JS is running
  (window as any).__JS_RUNNING__ = true;
}

// Helper to safely access localStorage in restricted environments
const safeStorage = {
  getItem: (key: string) => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch (e) {}
  },
  clear: () => {
    try { localStorage.clear(); } catch (e) {}
  }
};

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL RENDER ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#0F172A', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>App Temporarily Unavailable</h1>
          <p style={{ opacity: 0.8, textAlign: 'center', maxWidth: '400px' }}>Aura encountered an issue while loading. This can sometimes happen due to browser security settings.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '24px', padding: '12px 24px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
          >
            Restart Aura
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error("Failed to find root element");
}
