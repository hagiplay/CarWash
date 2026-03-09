import { NextResponse } from 'next/server';
import { sql, ensureTablesExist } from '@/lib/db';

export async function GET() {
  try {
    await ensureTablesExist();
    const { rows } = await sql`
      SELECT id, date_time, customer_name, customer_phone, created_at, status
      FROM bookings
      ORDER BY date_time ASC
    `;
    const bookings = rows.map((row) => ({
      id: row.id,
      dateTime: row.date_time,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      createdAt: row.created_at,
      status: row.status,
    }));
    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTablesExist();
    const booking = await request.json();
    await sql`
      INSERT INTO bookings (id, date_time, customer_name, customer_phone, created_at, status)
      VALUES (
        ${booking.id},
        ${booking.dateTime},
        ${booking.customerName},
        ${booking.customerPhone},
        ${booking.createdAt},
        ${booking.status}
      )
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
