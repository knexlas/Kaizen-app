import { useEffect, useMemo, Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { getSettings } from '../../services/userSettings';
import { shouldReduceMotion } from '../../services/motion';
import { hasWebGLSupport } from '../../services/webglSupport';
import GardenWalkScene from './GardenWalkScene';

const MODE_LINES = {
  helpStart: "When you're ready, pick one small step below or skip to your garden.",
  afterFocus: 'Nice focus. You can add another block or return to your garden.',
  default: 'Take a moment. Choose an action below or close when ready.',
};

export default function GardenWalkOverlay({
  open,
  mode = 'helpStart',
  onClose,
  onSimpleMode,
  onAction,
  actions = [],
}) {
  const [settings, setSettings] = useState(null);
  const reduceMotion = useMemo(() => shouldReduceMotion(settings), [settings]);
  const use3D = useMemo(() => hasWebGLSupport() && !reduceMotion, [reduceMotion]);

  useEffect(() => {
    setSettings(getSettings());
  }, [open]);

  const line = MODE_LINES[mode] ?? MODE_LINES.default;

  if (!open) return null;

  return (
    <div
      className="garden-walk-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Guided garden walk"
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--card-bg, #1a1a1a)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text-muted, #999)',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            height: use3D ? 160 : 80,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16,
            background: 'var(--surface, #252525)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {use3D ? (
            <Suspense fallback={<span style={{ color: '#6b8f71' }}>🌿</span>}>
              <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }} dpr={[1, 1.5]}>
                <GardenWalkScene />
              </Canvas>
            </Suspense>
          ) : (
            <span style={{ fontSize: 48 }} aria-hidden>🌿</span>
          )}
        </div>
        <p style={{ margin: '0 0 16px', color: 'var(--text, #e0e0e0)', lineHeight: 1.5 }}>
          {line}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #444)',
              background: 'transparent',
              color: 'var(--text-muted, #999)',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onSimpleMode}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #444)',
              background: 'var(--surface, #252525)',
              color: 'var(--text, #e0e0e0)',
              cursor: 'pointer',
            }}
          >
            Simple mode
          </button>
          {actions.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => onAction(a.type)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent, #4a7c59)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
