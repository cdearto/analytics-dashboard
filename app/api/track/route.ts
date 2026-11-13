// Ingestion endpoint for the tracker. Always answers 204 quickly; never errors to the visitor.
import { insertHit, overLimit, pruneOldHits, dayOf } from '@/lib/db.ts';
import { isBot, parseUserAgent, trafficSource, visitorId, clientIp, geoFromHeaders } from '@/lib/tracking.ts';

const noContent = () => new Response(null, { status: 204 });
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: Request): Promise<Response> {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 4096) return noContent();
    const ip = clientIp(request.headers);
    if (overLimit('track', ip, 120, 60)) return noContent();   // 120 hits a minute per address; a flood is dropped

    const body = JSON.parse(await request.text()) as Record<string, unknown>;
    const ua = request.headers.get('user-agent') ?? '';
    const bot = isBot(ua);
    const now = new Date();
    const day = dayOf(now);
    const referrer = text(body.ref, 300);
    insertHit({
      ts: Math.floor(now.getTime() / 1000), day,
      type: body.type === 'event' ? 'event' : 'pageview',
      name: text(body.name, 60), path: text(body.path, 300) || '/', referrer,
      source: trafficSource(referrer, text(body.utm, 60), request.headers.get('host') ?? ''),
      visitor: visitorId(ip, ua, day),
      ...parseUserAgent(ua),
      ...(bot ? { country: '', region: '', city: '' } : geoFromHeaders(request.headers)),
      isBot: bot,
    });
    if (Math.random() < 0.002) pruneOldHits();
  } catch {
    // Malformed beacons are ignored.
  }
  return noContent();
}
