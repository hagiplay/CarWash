import { NextResponse } from 'next/server';
import { sql, ensureTablesExist } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    await ensureTablesExist();
    const { date } = await params;
    await sql`DELETE FROM blocked_dates WHERE date_string = ${date}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/blocked-dates/[date] error:', error);
    return NextResponse.json({ error: 'Failed to remove blocked date' }, { status: 500 });
  }
}
