export {metadata} from '@/lib/layout-config'
import {geistSans, geistMono} from '@/lib/layout-config'
import './globals.css'

import YandexMetrika from '~/global/analytics'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}

        {process.env.NODE_ENV === 'production' && <YandexMetrika />}
      </body>
    </html>
  )
}
