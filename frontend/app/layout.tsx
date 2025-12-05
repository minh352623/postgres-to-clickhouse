import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Streaming Dashboard | Orders Analytics',
  description: 'Real-time order analytics powered by Postgres, Vector, Kafka, and ClickHouse',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
