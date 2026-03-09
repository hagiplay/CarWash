import { NextResponse } from 'next/server';
import { sql, ensureTablesExist } from '@/lib/db';

export async function GET() {
  try {
    await ensureTablesExist();
    const { rows } = await sql`SELECT date_string FROM blocked_dates ORDER BY date_string ASC`;
    return NextResponse.json({ dates: rows.map((r) => r.date_string) });
  } catch (error) {
    console.error('GET /api/blocked-dates error:', error);
    return NextResponse.json({ dates: [] });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    const { date } = await request.json();
    await sql`
      INSERT INTO blocked_dates (date_string) VALUES (${date})
      ON CONFLICT DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/blocked-dates error:', error);
    return NextResponse.json({ error: 'Failed to add blocked date' }, { status: 500 });
  }
}
