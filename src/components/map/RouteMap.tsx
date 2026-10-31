import L from 'leaflet';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import { Maximize2, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ORIGIN } from '../../lib/enrich';
import { RouteLayer, type Project, type RouteDatum } from './RouteLayer';

interface MapProps {
  routes: RouteDatum[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  maxTonnes?: number;
  maxIntensity?: number;
  compact?: boolean;
  className?: string;
  /** Routes used only to set the map extent (e.g. A and B together so both maps match). */
  fitTo?: RouteDatum[];
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Points to fit, padded to a minimum extent so a short route still shows the region around it. */
const boundsOf = (routes: RouteDatum[]) => {
  const pts: [number, number][] = [[ORIGIN.lat, ORIGIN.lng], ...routes.filter((r) => r.tonnes > 0).map((r) => [r.lat, r.lng] as [number, number])];
  const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1]);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2, cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const MIN_LAT = 4, MIN_LNG = 8;
  if (Math.max(...lats) - Math.min(...lats) < MIN_LAT) pts.push([cLat - MIN_LAT / 2, cLng], [cLat + MIN_LAT / 2, cLng]);
  if (Math.max(...lngs) - Math.min(...lngs) < MIN_LNG) pts.push([cLat, cLng - MIN_LNG / 2], [cLat, cLng + MIN_LNG / 2]);
  return pts;
};

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

let tileProbe: Promise<boolean> | null = null;
/**
 * True when CARTO serves real tiles. Two different tiles with identical bytes means the
 * service is returning a placeholder (e.g. "API key required"), which loads without error.
 */
function tilesUsable() {
  tileProbe ??= (async () => {
    try {
      const get = (z: number, x: number, y: number) =>
        fetch(TILE_URL.replace('{s}', 'a').replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{r}', ''))
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()));
      const [a, b] = await Promise.all([get(0, 0, 0), get(5, 18, 9)]);
      if (a.byteLength !== b.byteLength) return true;
      const va = new Uint8Array(a), vb = new Uint8Array(b);
      return va.some((v, i) => v !== vb[i]);
    } catch {
      return false;
    }
  })();
  return tileProbe;
}

/**
 * Interactive map: Leaflet with CARTO light tiles (tinted green), routes drawn in an SVG overlay.
 * Falls back to a d3-geo outline map when tiles cannot be loaded.
 */
export function RouteMap(props: MapProps) {
  const [tiles, setTiles] = useState<boolean | null>(null);
  useEffect(() => { if (!props.compact) tilesUsable().then(setTiles); }, [props.compact]);
  if (props.compact || !tiles) return <GeoMap {...props} />;
  return <LeafletMap {...props} onTilesFailed={() => setTiles(false)} />;
}

function LeafletMap({ routes, selectedId, onSelect, maxTonnes, maxIntensity, className = '', onTilesFailed }: MapProps & { onTilesFailed: () => void }) {
  const [wrap, size] = useSize<HTMLDivElement>();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [, setTick] = useState(0);
  const pts = useMemo(() => boundsOf(routes), [routes]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      zoomControl: false, attributionControl: true, zoomAnimation: false, scrollWheelZoom: false, minZoom: 3, maxZoom: 9,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    let loaded = 0, failed = 0;
    const tiles = L.tileLayer(TILE_URL, {
      subdomains: 'abcd', maxZoom: 19, className: 'lzp-tiles',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    });
    tiles.on('tileload', () => loaded++);
    tiles.on('tileerror', () => { failed++; if (failed >= 4 && loaded === 0) onTilesFailed(); });
    tiles.addTo(m);
    const timer = window.setTimeout(() => { if (loaded === 0) onTilesFailed(); }, 6000);
    m.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
    const redraw = () => setTick((t) => t + 1);
    m.on('move zoom resize', redraw);
    map.current = m;
    redraw();
    return () => { window.clearTimeout(timer); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitted = useRef(false);
  useEffect(() => {
    if (!map.current || !size.width || !size.height) return;
    map.current.invalidateSize();
    if (!fitted.current) {
      map.current.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
      fitted.current = true;
    }
  }, [size.width, size.height, pts]);

  const project: Project = (lat, lng) => {
    if (!map.current) return [0, 0];
    const p = map.current.latLngToContainerPoint([lat, lng]);
    return [p.x, p.y];
  };

  return (
    <div ref={wrap} className={`relative overflow-hidden rounded-2xl bg-mint-100 ${className}`}>
      <div ref={el} className="absolute inset-0" />
      {map.current && size.width > 0 && (
        <RouteLayer
          routes={routes} project={project} width={size.width} height={size.height} origin={ORIGIN}
          selectedId={selectedId} onSelect={onSelect} maxTonnes={maxTonnes} maxIntensity={maxIntensity}
        />
      )}
    </div>
  );
}

let worldCache: Promise<GeoJSON.FeatureCollection> | null = null;
function loadWorld() {
  worldCache ??= import('world-atlas/countries-50m.json').then((m) => {
    const topo = (m as unknown as { default: TopoJSON.Topology }).default ?? m;
    return feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
  });
  return worldCache;
}

export interface MapPoint {
  id: string;
  kind: 'partner' | 'city';
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  verified: boolean;
}

interface GeoMapProps extends MapProps {
  /** Zoom (wheel, double-click, buttons) and pan (drag). */
  interactive?: boolean;
  /** Clickable places shown under the routes. */
  points?: MapPoint[];
  /** Content of the popover opened by clicking a point. */
  renderPopover?: (id: string, close: () => void) => ReactNode;
}

const MIN_K = 1, MAX_K = 14;

/** Outline map (no tiles). Used as the tile fallback, for small maps, and as the interactive result map. */
export function GeoMap({ routes, selectedId, onSelect, maxTonnes, maxIntensity, compact, className = '', fitTo, interactive = false, points = [], renderPopover }: GeoMapProps) {
  const [wrap, size] = useSize<HTMLDivElement>();
  const [world, setWorld] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => { loadWorld().then(setWorld).catch(() => setWorld(null)); }, []);

  const pts = useMemo(() => boundsOf(fitTo ?? routes), [routes, fitTo]);
  const projection = useMemo(() => {
    const pad = compact ? 18 : 48;
    const bbox: GeoJSON.Feature = {
      type: 'Feature', properties: {},
      geometry: { type: 'MultiPoint', coordinates: pts.map(([lat, lng]) => [lng, lat]) },
    };
    return geoMercator().fitExtent([[pad, pad], [Math.max(pad + 1, size.width - pad), Math.max(pad + 1, size.height - pad)]], bbox);
  }, [pts, size.width, size.height, compact]);
  const active = new Set(['428', '440', '233', '616', '246', '804']); // LV LT EE PL FI UA (ISO numeric)
  // Country outlines only change with the fit, not with routes or the zoom/pan transform.
  const land = useMemo(() => {
    const path = geoPath(projection);
    return (world?.features ?? []).map((f) => ({ d: path(f as GeoPermissibleObjects) ?? '', on: active.has(String(f.id)) }));
  }, [world, projection]); // eslint-disable-line react-hooks/exhaustive-deps

  // View transform on top of the fitted projection: screen = base * k + (x, y).
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitKey = pts.map((p) => p.join(',')).join(';');
  useEffect(() => { setView({ k: 1, x: 0, y: 0 }); }, [fitKey, size.width, size.height]);

  const zoomAt = (factor: number, cx: number, cy: number) => {
    const v = viewRef.current;
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    const f = k / v.k;
    setView({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
  };

  useEffect(() => {
    const el = wrap.current;
    if (!interactive || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0 || (e.target as HTMLElement).closest('[data-map-ui]')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    moved.current = false;
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) { moved.current = true; setDragging(true); }
      setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    };
    const up = () => {
      drag.current = null;
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const project: Project = (lat, lng) => {
    const [px, py] = projection([lng, lat]) as [number, number];
    return [px * view.k + view.x, py * view.k + view.y];
  };
  const routeEnds = new Set(routes.map((r) => `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`));
  const openPoint = points.find((p) => p.id === open);

  return (
    <div
      ref={wrap}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); moved.current = false; } }}
      onDoubleClick={(e) => {
        if (!interactive || (e.target as HTMLElement).closest('[data-map-ui]')) return;
        const r = e.currentTarget.getBoundingClientRect();
        zoomAt(2, e.clientX - r.left, e.clientY - r.top);
      }}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-map-ui]')) setOpen(null); }}
      className={`relative select-none overflow-hidden rounded-2xl bg-[#D3DAD6] ${interactive ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''} ${className}`}
      style={{ touchAction: interactive ? 'none' : undefined }}
    >
      {size.width > 0 && (
        <>
          <svg width={size.width} height={size.height} className="absolute inset-0">
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {land.map((f, i) => (
                <path key={i} d={f.d} vectorEffect="non-scaling-stroke" fill={f.on ? '#FFFFFF' : '#EEF1EF'} stroke={f.on ? '#AFB8B4' : '#D6DBD8'} strokeWidth={0.7} />
              ))}
            </g>
          </svg>

          {/* Places that can be picked from the map */}
          {points.map((p) => {
            const [x, y] = project(p.lat, p.lng);
            if (x < -20 || y < -20 || x > size.width + 20 || y > size.height + 20) return null;
            const onRoute = routeEnds.has(`${p.lat.toFixed(3)},${p.lng.toFixed(3)}`);
            const showLabel = hover === p.id || open === p.id || (view.k >= 3 && p.kind === 'city');
            return (
              <button
                key={p.id}
                data-map-ui
                onClick={(e) => { e.stopPropagation(); setOpen(open === p.id ? null : p.id); }}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                className="group absolute z-[410] -translate-x-1/2 -translate-y-1/2 p-1.5"
                style={{ left: x, top: y }}
                aria-label={`${p.label}, ${p.sub ?? ''}`}
              >
                {p.kind === 'partner' ? (
                  <span className={`block rounded-full border-2 bg-white transition-transform duration-150 group-hover:scale-150 ${p.verified ? 'h-3 w-3' : 'h-2.5 w-2.5'} ${onRoute ? 'border-lime-700' : p.verified ? 'border-coal' : 'border-muted/60'}`} />
                ) : (
                  <span className="block h-2 w-2 rotate-45 bg-stone transition-all duration-150 group-hover:scale-150 group-hover:bg-coal" />
                )}
                {showLabel && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-coal px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                    {p.label}
                  </span>
                )}
              </button>
            );
          })}

          <RouteLayer
            routes={routes} project={project} width={size.width} height={size.height} origin={ORIGIN}
            selectedId={selectedId} onSelect={onSelect} maxTonnes={maxTonnes} maxIntensity={maxIntensity} compact={compact}
          />

          {openPoint && renderPopover && (() => {
            const [x, y] = project(openPoint.lat, openPoint.lng);
            const left = Math.min(Math.max(8, x + 14), size.width - 296);
            const top = Math.min(Math.max(8, y - 20), size.height - 210);
            return (
              <div data-map-ui className="absolute z-[520] rounded-2xl border border-line bg-white p-4 shadow-card" style={{ left, top }}>
                <button onClick={() => setOpen(null)} className="absolute right-2 top-2 rounded-full p-1 text-muted hover:bg-paper hover:text-coal" aria-label="Close">
                  <X size={13} />
                </button>
                {renderPopover(openPoint.id, () => setOpen(null))}
              </div>
            );
          })()}

          {interactive && (
            <div data-map-ui className="absolute right-3 top-3 z-[500] flex flex-col overflow-hidden rounded-2xl bg-white shadow-card">
              <button onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)} className="p-2.5 hover:bg-lime" aria-label="Zoom in"><Plus size={15} /></button>
              <button onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)} className="border-y border-line p-2.5 hover:bg-lime" aria-label="Zoom out"><Minus size={15} /></button>
              <button onClick={() => setView({ k: 1, x: 0, y: 0 })} className="p-2.5 hover:bg-lime" aria-label="Fit route"><Maximize2 size={14} /></button>
            </div>
          )}
          {!compact && <span className="pointer-events-none absolute bottom-2 left-3 z-[450] font-mono text-[9px] text-muted">Outline map · Natural Earth</span>}
        </>
      )}
    </div>
  );
}
