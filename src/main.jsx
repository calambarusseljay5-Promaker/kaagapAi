import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import './styles/theme.scss'
import App from './App.jsx'

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Global React Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#02281B 0%,#043E2B 50%,#011B12 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}>
          <img src="/logo.png" alt="Barangay Logo" style={{ width: '80px', height: '80px', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>KaagapAI System Portal</h2>
          <p style={{ fontSize: '13px', color: '#A7F3D0', maxWidth: '360px', marginBottom: '16px', lineHeight: '1.5' }}>
            Encountered a system loading issue. Click <b>Clear Cache & Reload</b> or <b>Reload</b> below to refresh:
          </p>
          {this.state.error && (
            <div style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(239,68,68,0.5)',
              borderRadius: '8px',
              padding: '10px 14px',
              maxWidth: '90vw',
              maxHeight: '120px',
              overflow: 'auto',
              fontSize: '11px',
              color: '#FCA5A5',
              textAlign: 'left',
              marginBottom: '16px',
              fontFamily: 'monospace',
            }}>
              <b>Error:</b> {this.state.error.toString()}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={async () => {
                try {
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                  }
                  if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) await reg.unregister();
                  }
                } catch (e) {}
                window.location.href = window.location.pathname + '?nocache=' + Date.now();
              }}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              🧹 Clear Cache & Reload
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '12px 18px',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              🔄 Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </GlobalErrorBoundary>
  </StrictMode>,
)
