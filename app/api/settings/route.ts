import { NextResponse } from 'next/server';
import { sql, ensureTablesExist } from '@/lib/db';

const DEFAULT_SETTINGS = {
  workingHours: {
    sunday: { enabled: true, start: '08:00', end: '18:00' },
    monday: { enabled: true, start: '08:00', end: '18:00' },
    tuesday: { enabled: true, start: '08:00', end: '18:00' },
    wednesday: { enabled: true, start: '08:00', end: '18:00' },
    thursday: { enabled: true, start: '08:00', end: '18:00' },
    friday: { enabled: true, start: '08:00', end: '16:00' },
    saturday: { enabled: false, start: '00:00', end: '00:00' },
  },
  serviceDuration: 45,
  gapBetweenServices: 15,
  bookingHorizon: 30,
  minLeadTime: 60,
  adminPassword: 'noam2024',
  businessAddress: 'קטיף 14 הושעיה (שלב ז׳)',
  businessPhone: '0586614800',
};

export async function GET() {
  try {
    await ensureTablesExist();
    const { rows } = await sql`SELECT data FROM app_settings WHERE id = 1`;
    const settings = rows.length > 0 ? rows[0].data : DEFAULT_SETTINGS;
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTablesExist();
    const { settings } = await request.json();
    await sql`
      INSERT INTO app_settings (id, data)
      VALUES (1, ${JSON.stringify(settings)})
      ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(settings)}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
