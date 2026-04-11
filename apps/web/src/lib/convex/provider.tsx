'use client'

import {ConvexProvider as Convex, ConvexReactClient} from 'convex/react'
import {ReactNode} from 'react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexProvider({children}: {children: ReactNode}) {
  return <Convex client={convex}>{children}</Convex>
}
