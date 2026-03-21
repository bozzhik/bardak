export {metadata} from '@/lib/layout-config'
import {geistSans, geistMono} from '@/lib/layout-config'
import './globals.css'

import {cn} from '@/lib/utils'

import {TooltipProvider} from '~/ui/tooltip'
import {Toaster} from '~/ui/sonner'

import YandexMetrika from '~/global/analytics'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={cn([geistSans.variable, geistMono.variable], 'dark scroll-smooth')}>
      <body>
        <TooltipProvider>
          {children}

          <Toaster />
        </TooltipProvider>

        {process.env.NODE_ENV === 'production' && <YandexMetrika />}
      </body>
    </html>
  )
}
