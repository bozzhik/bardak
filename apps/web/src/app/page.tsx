'use client'

import {hello} from '@repo/shared'
import {useQuery, api} from '@/lib/convex'

import Container from '~/global/container'

export default function IndexPage() {
  const demo = useQuery(api.tables.demo.getDemo)

  console.log(hello('web'))

  return <Container>{hello(demo?.[0]?.username ?? 'mom')}</Container>
}
