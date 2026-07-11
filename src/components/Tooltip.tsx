export interface TooltipState {
  x: number;
  y: number;
  title: string;
  body?: string;
  meta?: string;
}

export function Tooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  const left = Math.min(state.x + 14, window.innerWidth - 360);
  const top = Math.min(state.y + 12, window.innerHeight - 120);
  return (
    <div className="tooltip" style={{ left, top }} role="status">
      <div className="tt-title">{state.title}</div>
      {state.body && <div className="tt-body">{state.body}</div>}
      {state.meta && <div className="tt-meta">{state.meta}</div>}
    </div>
  );
}
