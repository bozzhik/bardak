export {metadata} from '@/lib/layout-config'
import {geistSans, geistMono} from '@/lib/layout-config'
import './globals.css'

import {cn} from '@/lib/utils'

import {ConvexProvider} from '@/lib/convex'
import {TooltipProvider} from '~/ui/tooltip'
import YandexMetrika from '~/global/analytics'

import {Toaster} from '~/ui/sonner'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={cn([geistSans.variable, geistMono.variable], 'dark scroll-smooth')}>
      <body>
        <ConvexProvider>
          <TooltipProvider>
            {children}

            <Toaster />
          </TooltipProvider>
        </ConvexProvider>

        {process.env.NODE_ENV === 'production' && <YandexMetrika />}
      </body>
    </html>
  )
}
