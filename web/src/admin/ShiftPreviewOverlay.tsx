import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2;
const WHEEL_FACTOR = 0.002;

export function ShiftPreviewOverlay({ src, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; basePanX: number; basePanY: number } | null>(null);
  const lastTapRef = useRef(0);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => {
      const next = clamp(prev - e.deltaY * WHEEL_FACTOR * prev, MIN_SCALE, MAX_SCALE);
      if (next <= MIN_SCALE) { setPanX(0); setPanY(0); }
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, basePanX: panX, basePanY: panY };
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPanX(dragRef.current.basePanX + (e.clientX - dragRef.current.startX));
    setPanY(dragRef.current.basePanY + (e.clientY - dragRef.current.startY));
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => {
      if (prev > MIN_SCALE) { setPanX(0); setPanY(0); return MIN_SCALE; }
      return DOUBLE_TAP_ZOOM;
    });
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) return;
    lastTapRef.current = now;
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: scale > MIN_SCALE ? 'grab' : 'zoom-in',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10000,
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, lineHeight: 1,
        }}
        aria-label="閉じる"
      >
        ✕
      </button>
      <img
        src={src}
        alt="シフト表拡大プレビュー"
        draggable={false}
        style={{
          maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
          transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
          transition: dragRef.current ? 'none' : 'transform 0.15s ease-out',
          userSelect: 'none',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
