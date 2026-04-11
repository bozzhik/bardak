import Link from 'next/link'

import {DB_BOX} from '@/lib/utils-db'
import {dbMeta} from '@/lib/db/meta.generated'
import {dbAdminApi, dbTables} from '@/lib/db/registry.generated'

import {fetchQuery} from 'convex/nextjs'

import Container from '~/global/container'
import {Badge} from '~/primitives/badge'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '~/primitives/card'
import {Item, ItemActions, ItemContent, ItemGroup, ItemTitle} from '~/primitives/item'

export const dynamic = 'force-dynamic'

type LengthResult = {count: number; isTruncated: boolean}
type FetchQueryRef = Parameters<typeof fetchQuery>[0]

export default async function DatabasePage() {
  const lengths = await Promise.all(
    dbTables.map(async (table) => {
      const apiMod = dbAdminApi[table]
      const res = (await fetchQuery(apiMod.length as unknown as FetchQueryRef, {})) as LengthResult
      return [table, res] as const
    }),
  )
  const lengthByTable = Object.fromEntries(lengths) as Record<(typeof dbTables)[number], LengthResult>

  return (
    <Container className={DB_BOX}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Convex – Database View</CardTitle>
          <CardDescription>Browse tables and manage their documents.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ItemGroup>
            {dbTables.map((table) => {
              const meta = dbMeta[table]
              const len = lengthByTable[table]
              const fieldCount = Object.keys(meta.fields).length
              return (
                <Item
                  key={table}
                  variant="outline"
                  render={
                    <Link href={`/db/${table}`} className="w-full">
                      <div className="flex w-full items-center">
                        <ItemContent>
                          <ItemTitle className="no-underline">{table}</ItemTitle>
                        </ItemContent>
                        <ItemActions>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{fieldCount} fields</Badge>
                            <Badge variant="secondary">{len.isTruncated ? `${len.count}+` : len.count} items</Badge>
                          </div>
                        </ItemActions>
                      </div>
                    </Link>
                  }
                />
              )
            })}
          </ItemGroup>
        </CardContent>
      </Card>
    </Container>
  )
}
