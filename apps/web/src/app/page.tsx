'use client'

import {hello} from '@repo/shared'

import {useQuery, api} from '@/lib/convex'

export default function IndexPage() {
  const demo = useQuery(api.tables.demo.getDemo)

  console.log(hello('web'))

  return <main>{hello(demo?.[0]?.username ?? 'mom')}</main>
}
