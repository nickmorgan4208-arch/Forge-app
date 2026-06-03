import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forge',
  description: 'Build things that didn\'t exist yesterday',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
