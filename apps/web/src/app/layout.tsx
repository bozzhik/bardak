export {metadata} from '@/lib/layout-config'
import {geistSans, geistMono} from '@/lib/layout-config'
import './globals.css'

import {cn} from '@/lib/utils'

import YandexMetrika from '~/global/analytics'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={cn([geistSans.variable, geistMono.variable], 'dark scroll-smooth')}>
      <body>
        {children}

        {process.env.NODE_ENV === 'production' && <YandexMetrika />}
      </body>
    </html>
  )
}
