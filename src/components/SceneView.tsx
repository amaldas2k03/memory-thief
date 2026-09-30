import { useCallback, useId, useRef } from 'react';
import type { Scene, SceneObject, Hitbox } from '../game/types';
import { VIEW_W, VIEW_H } from '../game/types';
import { objectDef, resolvePaint, themeById } from '../game/objects';
import type { Shape } from '../game/objects';

export type Marker = {
  id: string;
  x: number;
  y: number;
  kind: 'hit' | 'miss';
};

export type Highlight = {
  id: string;
  hitbox: Hitbox;
  state: 'found' | 'missed';
  /** 1-based index shown in the badge, matching the reveal list. */
  index: number;
};

type Props = {
  scene: Scene;
  /** Called with viewBox coordinates. `touch` is true for finger/pen input. */
  onPick?: (x: number, y: number, touch: boolean) => void;
  markers?: Marker[];
  highlights?: Highlight[];
  /** Blur + darken, used for the memorise-phase "locked" state. */
  dimmed?: boolean;
  className?: string;
  label: string;
};

/** Renders one primitive from the object library. */
function renderShape(shape: Shape, color: string, text: string | undefined, key: number, flipped: boolean) {
  const fill = 'f' in shape ? resolvePaint(shape.f, color) : undefined;
  const stroke = 's' in shape && shape.s ? resolvePaint(shape.s, color) : undefined;
  const common = {
    fill,
    stroke,
    strokeWidth: 'sw' in shape ? shape.sw : undefined,
    strokeLinecap: 'cap' in shape && shape.cap === 'round' ? ('round' as const) : undefined,
    strokeLinejoin: 'round' as const,
  };

  switch (shape.t) {
    case 'rect':
      return <rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} {...common} />;
    case 'circle':
      return <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
    case 'ellipse':
      return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />;
    case 'path':
      return <path key={key} d={shape.d} {...common} />;
    case 'poly':
      return <polygon key={key} points={shape.p} {...common} />;
    case 'line':
      return (
        <line
          key={key}
          x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2}
          stroke={resolvePaint(shape.s, color)}
          strokeWidth={shape.sw}
          strokeLinecap="round"
        />
      );
    case 'label':
      // Counter-flip so signage stays readable on mirrored objects.
      return (
        <text
          key={key}
          x={shape.x}
          y={shape.y}
          transform={flipped ? `translate(${shape.x * 2}, 0) scale(-1, 1)` : undefined}
          fontSize={shape.size}
          fontWeight={shape.weight ?? 700}
          fill={resolvePaint(shape.f, color)}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Space Grotesk', system-ui, sans-serif"
          style={{ letterSpacing: '0.04em' }}
        >
          {text ?? ''}
        </text>
      );
    default:
      return null;
  }
}

function SceneObjectNode({ obj, groundY }: { obj: SceneObject; groundY: number }) {
  const def = objectDef(obj.kind);
  const shapes = def.shapes(obj.variant ?? 0);
  const flip = obj.flipped ? -1 : 1;
  // Objects standing on the ground get a soft contact shadow for depth.
  const onGround = obj.y >= groundY - 12;

  return (
    <g transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation}) scale(${obj.scale * flip} ${obj.scale})`}>
      {onGround && (
        <ellipse cx={0} cy={def.radius * 0.82} rx={def.radius * 0.72} ry={def.radius * 0.17} fill="rgba(0,0,0,0.16)" />
      )}
      {shapes.map((s, i) => renderShape(s, obj.color, obj.text, i, Boolean(obj.flipped)))}
    </g>
  );
}

/** Theme-specific treatment drawn on top of the ground band. */
function GroundPattern({ scene, groundY }: { scene: Scene; groundY: number }) {
  const bg = scene.background;
  switch (bg.pattern) {
    case 'grass':
      return (
        <g opacity={0.5}>
          {Array.from({ length: 26 }, (_, i) => {
            const x = 14 + i * 31;
            const y = groundY + 16 + ((i * 37) % 90);
            return <path key={i} d={`M${x} ${y} q3 -12 6 0`} fill="none" stroke={bg.accent} strokeWidth={3} strokeLinecap="round" />;
          })}
        </g>
      );
    case 'tiles':
      return (
        <g opacity={0.45}>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1={groundY} x2={i * 100 - 40} y2={VIEW_H} stroke={bg.accent} strokeWidth={2} />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={groundY + 22 + i * 60} x2={VIEW_W} y2={groundY + 22 + i * 60} stroke={bg.accent} strokeWidth={2} />
          ))}
        </g>
      );
    case 'road':
      return (
        <g>
          <rect x={0} y={groundY} width={VIEW_W} height={12} fill={bg.accent} opacity={0.55} />
          <rect x={0} y={groundY + 96} width={VIEW_W} height={6} fill={bg.accent} opacity={0.35} />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={12 + i * 84} y={groundY + 52} width={46} height={7} rx={3.5} fill={bg.accent} opacity={0.8} />
          ))}
        </g>
      );
    case 'sand':
      return (
        <g opacity={0.5}>
          <path
            d={`M0 ${groundY + 6} q100 -16 200 0 t200 0 t200 0 t200 0 V${VIEW_H} H0 Z`}
            fill={bg.accent}
            opacity={0.25}
          />
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={24 + i * 57} cy={groundY + 34 + ((i * 53) % 60)} r={2.6} fill="#B9A472" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export function SceneView({ scene, onPick, markers = [], highlights = [], dimmed = false, className, label }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const downRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const rawId = useId();
  // useId returns ':r0:' style strings — strip the colons so they are valid in url(#...).
  const uid = rawId.replace(/:/g, '');

  const bg = scene.background;
  const groundY = VIEW_H * bg.horizon;
  const theme = themeById(scene.theme);

  /**
   * Convert a client-space point into viewBox space.
   * `preserveAspectRatio` letterboxing and any CSS scaling are both handled by
   * the inverse screen CTM, so this stays correct at every viewport size.
   */
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    try {
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    } catch {
      return null;
    }
  }, []);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    downRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const down = downRef.current;
    downRef.current = null;
    if (!down || down.id !== event.pointerId) return;
    // Ignore drags / scroll gestures — only a tap counts as a guess.
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 14) return;
    const point = toViewBox(event.clientX, event.clientY);
    if (!point) return;
    onPick(point.x, point.y, event.pointerType !== 'mouse');
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`scene-surface block h-auto w-full ${onPick ? 'cursor-crosshair' : ''} ${className ?? ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { downRef.current = null; }}
      role="img"
      aria-label={`${label}. Scene: ${theme.name}.`}
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.skyTop} />
          <stop offset="100%" stopColor={bg.skyBottom} />
        </linearGradient>
        <linearGradient id={`ground-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.groundColor} />
          <stop offset="100%" stopColor={resolvePaint('d1', bg.groundColor)} />
        </linearGradient>
        <clipPath id={`frame-${uid}`}>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} rx="14" />
        </clipPath>
      </defs>

      <g clipPath={`url(#frame-${uid})`}>
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#sky-${uid})`} />
        <rect x="0" y={groundY} width={VIEW_W} height={VIEW_H - groundY} fill={`url(#ground-${uid})`} />
        <GroundPattern scene={scene} groundY={groundY} />

        {scene.objects.map((obj) => (
          <SceneObjectNode key={obj.id} obj={obj} groundY={groundY} />
        ))}

        {/* Reveal-screen highlights: green for found, amber for missed. */}
        {highlights.map((h) => (
          <g key={h.id}>
            <circle
              cx={h.hitbox.x}
              cy={h.hitbox.y}
              r={h.hitbox.r}
              fill="none"
              stroke={h.state === 'found' ? '#2ecc8f' : '#f59f4a'}
              strokeWidth={5}
              strokeDasharray={h.state === 'found' ? undefined : '12 9'}
              opacity={0.95}
            />
            <circle cx={h.hitbox.x + h.hitbox.r * 0.72} cy={h.hitbox.y - h.hitbox.r * 0.72} r={15}
              fill={h.state === 'found' ? '#2ecc8f' : '#f59f4a'} />
            <text
              x={h.hitbox.x + h.hitbox.r * 0.72}
              y={h.hitbox.y - h.hitbox.r * 0.72}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={17}
              fontWeight={800}
              fill="#0b1221"
              fontFamily="'Space Grotesk', system-ui, sans-serif"
            >
              {h.index}
            </text>
          </g>
        ))}

        {/* Click feedback. Rings expand from the tap point; misses show a red X. */}
        {markers.map((m) => (
          <g key={m.id} transform={`translate(${m.x} ${m.y})`}>
            {m.kind === 'hit' ? (
              <>
                <circle className="mt-ring" r={12} fill="none" stroke="#2ecc8f" strokeWidth={5} vectorEffect="non-scaling-stroke" />
                <circle r={13} fill="#2ecc8f" opacity={0.92} />
                <path d="M-6 0 l4 4 l8 -9" fill="none" stroke="#08301f" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <g className="mt-miss">
                <circle r={13} fill="#e8483f" />
                <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
              </g>
            )}
          </g>
        ))}

        {dimmed && <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#080d1a" opacity={0.55} />}
      </g>

      <rect
        x="1" y="1" width={VIEW_W - 2} height={VIEW_H - 2} rx="14"
        fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="2"
      />
    </svg>
  );
}
