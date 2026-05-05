import { useStore } from './store';

export function HUD() {
  const bpm = useStore((s) => s.bpm);
  const phase = useStore((s) => s.phase);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          color: '#ffcc00',
          font: '18px monospace',
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        BPM: {Math.round(bpm)}
      </div>
      {phase === 'GAME_OVER' && (
        <div
          style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ffcc00',
            font: 'bold 28px monospace',
            textAlign: 'center',
            textShadow: '0 0 12px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
          }}
        >
          DAWN<br />The cats are just cats.
        </div>
      )}
    </>
  );
}
