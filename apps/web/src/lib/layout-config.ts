import type {Metadata} from 'next'
import {Geist, Geist_Mono} from 'next/font/google'

export const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
})

export const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: {
    template: '%s — Bardak',
    default: 'Bardak',
  },
}
