// Drop-in script for sites not built with this app:
//   <script src="https://your-analytics-host/track.js" defer></script>
// Beacons go back to whichever host served the script.
import { startTracking } from '@/lib/tracker.ts';

export function GET(request: Request): Response {
  const endpoint = JSON.stringify(`${new URL(request.url).origin}/api/track`);
  return new Response(`(${startTracking.toString()})(${endpoint})();\n`, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
