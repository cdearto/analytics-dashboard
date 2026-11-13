// CSV of the daily series for the selected range.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, isValidSessionToken } from '@/lib/auth.ts';
import { RANGES, daily, periods } from '@/lib/reports.ts';
import { toCsv } from '@/lib/csv.ts';

export async function GET(request: Request): Promise<Response> {
  if (!isValidSessionToken((await cookies()).get(SESSION_COOKIE)?.value)) return new Response('Sign in first.', { status: 401 });
  const asked = Number(new URL(request.url).searchParams.get('range'));
  const { current } = periods(RANGES.find((r) => r === asked) ?? 30);
  const lines = [['day', 'visitors', 'pageviews', 'events'], ...daily(current.from, current.to).map((d) => [d.day, d.visitors, d.pageviews, d.events])];
  return new Response(toCsv(lines), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="analytics-${current.from}-to-${current.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
