import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'שטיפת הרכבים של נעם - זימון תורים',
  description: 'מערכת זימון תורים לשטיפת רכבים - נעם בן משה',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
