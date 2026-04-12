'use client'

import {PencilIcon, TrashIcon} from 'lucide-react'

import {dbMeta, type FieldMeta} from '@/lib/db/meta.generated'
import {assertDbTable, dbAdminApi, isDbTable} from '@/lib/db/registry.generated'
import {DB_BOX} from '@/lib/utils-db'

import {useMemo, useState, Fragment} from 'react'
import {useParams} from 'next/navigation'
import {useMutation, usePaginatedQuery} from 'convex/react'

import {coerceDbAdminFieldInput, defaultValueForField, formatConvexCreationTime, formatDbAdminCellValue, humanizeTableSlug, shortConvexDocumentId} from '@/lib/utils-db'
import {cn} from '@/lib/utils'

import Link from 'next/link'
import Container from '~/global/container'
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from '~/primitives/alert-dialog'
import {Badge} from '~/primitives/badge'
import {Button} from '~/primitives/button'
import {ButtonGroup} from '~/primitives/button-group'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '~/primitives/card'
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from '~/primitives/dialog'
import {Empty, EmptyDescription, EmptyHeader, EmptyTitle} from '~/primitives/empty'
import {Field, FieldContent, FieldGroup, FieldTitle} from '~/primitives/field'
import {Input} from '~/primitives/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '~/primitives/select'
import {Spinner} from '~/primitives/spinner'
import {Switch} from '~/primitives/switch'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '~/primitives/table'
import {Textarea} from '~/primitives/textarea'
import {Tooltip, TooltipContent, TooltipTrigger} from '~/primitives/tooltip'

export type DatabaseDocument = {
  _id: string
  _creationTime: number
  [key: string]: unknown
}

type CellRenderer = (args: {table: string; column: string; row: DatabaseDocument; value: unknown}) => React.ReactNode

/** Lucide: fixed glyph box + uniform stroke (optical match). */
const tableRowActionIconClass = '[&_svg]:!size-3.5 [&_svg]:!min-h-3.5 [&_svg]:!min-w-3.5 [&_svg]:!max-h-3.5 [&_svg]:!max-w-3.5 [&_svg]:shrink-0 [&_svg]:![stroke-width:1.75]'

/** Same 28×28; inner borders off so outline/destructive match; ButtonGroup draws outer pill + segment joins. */
const tableRowActionBtnClass = 'box-border !inline-flex !size-7 !items-center !justify-center !gap-0 shrink-0 !border-0 !p-0 shadow-none focus-visible:relative focus-visible:z-10 in-data-[slot=button-group]:shadow-none'

function priorityBadgeClasses(value: string) {
  switch (value) {
    case 'low':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'medium':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'high':
      return 'border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-300'
    case 'urgent':
      return 'border-rose-500/25 bg-rose-500/12 text-rose-700 dark:text-rose-300'
    default:
      return 'border-border bg-muted/40 text-foreground'
  }
}

function statusBadgeClasses(value: string) {
  switch (value) {
    case 'draft':
      return 'border-border bg-muted/40 text-foreground'
    case 'review':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
    case 'ready':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'in_progress':
      return 'border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-300'
    case 'done':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'rejected':
      return 'border-rose-500/25 bg-rose-500/12 text-rose-700 dark:text-rose-300'
    default:
      return 'border-border bg-muted/40 text-foreground'
  }
}

const dbTableUi: Record<
  string,
  Partial<{
    visibleFields: string[]
    cellRenderers: Record<string, CellRenderer>
  }>
> = {
  users: {
    visibleFields: ['userId', 'username'],
  },
  concepts: {
    visibleFields: ['token', 'summary', 'details', 'priority', 'status', 'tags'],
    cellRenderers: {
      token: ({value}) => (
        <Badge variant="secondary" className="font-mono text-[11px] font-medium">
          {String(value ?? '')}
        </Badge>
      ),
      priority: ({value}) => {
        const v = String(value ?? '')
        return (
          <Badge variant="outline" className={cn('border font-medium', priorityBadgeClasses(v))}>
            {v || '—'}
          </Badge>
        )
      },
      status: ({value}) => {
        const v = String(value ?? '')
        return (
          <Badge variant="outline" className={cn('border font-medium', statusBadgeClasses(v))}>
            {v || '—'}
          </Badge>
        )
      },
      tags: ({value}) => {
        if (!Array.isArray(value)) return <span className="text-muted-foreground">—</span>
        const tags = value.map(String).filter(Boolean)
        if (tags.length === 0) return <span className="text-muted-foreground">—</span>
        const full = tags.join(', ')
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <span className="min-w-0 max-w-[16rem] truncate">{full}</span>
                  <span className="shrink-0 text-muted-foreground">[]</span>
                </span>
              }
            />
            <TooltipContent side="top" className="max-w-sm">
              <div className="text-xs text-muted-foreground">{tags.length} items</div>
              <div className="wrap-break-word font-mono text-xs">{full}</div>
            </TooltipContent>
          </Tooltip>
        )
      },
    },
  },
}

function renderIdCell(id: string) {
  const full = id
  return (
    <TableCell className="max-w-32">
      <Tooltip>
        <TooltipTrigger
          render={
            <button type="button" className="inline-flex min-w-0 max-w-full cursor-default border-0 bg-transparent p-0 text-left" data-id={full}>
              <Badge variant="outline" className="min-w-0 max-w-full justify-start truncate font-mono text-xs font-normal pointer-events-none">
                {shortConvexDocumentId(full, {head: 5, tail: 4})}
              </Badge>
            </button>
          }
        />
        <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs">
          {full}
        </TooltipContent>
      </Tooltip>
    </TableCell>
  )
}

function renderCreationTimeCell(value: unknown) {
  return <TableCell className="text-muted-foreground tabular-nums">{formatConvexCreationTime(value)}</TableCell>
}

function DatabaseTablePageInner({slug}: {slug: string}) {
  const PAGE_SIZE = 50

  const table = assertDbTable(slug)
  const meta = dbMeta[table] as {fields: Record<string, FieldMeta>}

  const apiMod = dbAdminApi[table]
  type UsePaginatedQueryFn = Parameters<typeof usePaginatedQuery>[0]
  type UseMutationFn = Parameters<typeof useMutation>[0]

  const {results, status, loadMore, isLoading} = usePaginatedQuery(apiMod.list as unknown as UsePaginatedQueryFn, {paginationOpts: {cursor: null, numItems: PAGE_SIZE}}, {initialNumItems: PAGE_SIZE})

  const createMut = useMutation(apiMod.create as unknown as UseMutationFn)
  const updateMut = useMutation(apiMod.update as unknown as UseMutationFn)
  const removeMut = useMutation(apiMod.remove as unknown as UseMutationFn)

  const fields = useMemo(() => Object.entries(meta.fields), [meta.fields])
  const orderedFieldNames = useMemo(() => {
    const allFields = Object.keys(meta.fields)
    const custom = dbTableUi[table]?.visibleFields
    if (!custom?.length) return allFields

    const customSet = new Set(custom)
    const prioritized = custom.filter((field) => allFields.includes(field))
    const rest = allFields.filter((field) => !customSet.has(field))
    return [...prioritized, ...rest]
  }, [meta.fields, table])
  const columnNames = useMemo(() => ['_id', ...orderedFieldNames, '_creationTime'], [orderedFieldNames])
  const tableTitle = humanizeTableSlug(table)

  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<DatabaseDocument | null>(null)
  const [viewRow, setViewRow] = useState<DatabaseDocument | null>(null)

  const [createDraft, setCreateDraft] = useState<Record<string, unknown>>({})
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({})

  function parseCsvTags(input: string): string[] {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function formatCsvTags(value: unknown): string {
    if (typeof value === 'string') return value
    if (!Array.isArray(value)) return ''
    return value.map(String).join(', ')
  }

  function resetCreate() {
    setCreateDraft({})
    setCreateOpen(false)
  }

  function openEdit(row: DatabaseDocument) {
    setEditRow(row)
    setEditDraft({})
  }

  function openView(row: DatabaseDocument) {
    setViewRow(row)
  }

  const cellRendererByColumn = useMemo(() => {
    const perTable = dbTableUi[table]?.cellRenderers ?? {}
    return perTable
  }, [table])

  const renderCell: CellRenderer = ({column, row, value}) => {
    if (column === '_id') return renderIdCell(String(row._id))
    if (column === '_creationTime') return renderCreationTimeCell(value)
    if (value == null) {
      return <TableCell className="text-muted-foreground/55">null</TableCell>
    }
    const custom = cellRendererByColumn[column]
    if (custom) return <TableCell>{custom({table, column, row, value})}</TableCell>
    return <TableCell>{formatDbAdminCellValue(value)}</TableCell>
  }

  async function onCreate() {
    const doc: Record<string, unknown> = {}
    for (const [name, m] of fields) {
      if (createDraft[name] !== undefined) {
        if (name === 'tags' && typeof createDraft[name] === 'string') {
          const parsed = parseCsvTags(createDraft[name] as string)
          if (parsed.length) doc[name] = parsed
        } else {
          doc[name] = createDraft[name]
        }
      } else if (!m.optional) doc[name] = defaultValueForField(m)
    }
    await createMut({doc} as never)
    resetCreate()
  }

  async function onUpdate() {
    if (!editRow) return
    const patch: Record<string, unknown> = {...editDraft}
    if (typeof patch.tags === 'string') {
      const parsed = parseCsvTags(patch.tags)
      patch.tags = parsed
    }
    await updateMut({id: editRow._id, patch} as never)
    setEditRow(null)
    setEditDraft({})
  }

  async function onRemove(docId: string) {
    await removeMut({id: docId} as never)
  }

  return (
    <Container className={DB_BOX}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/db" className="text-sm text-muted-foreground hover:text-foreground">
            DB
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">{table}</span>
        </div>

        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button>Create</Button>} />
            <DialogContent showCloseButton>
              <DialogHeader>
                <DialogTitle>Create</DialogTitle>
                <DialogDescription>{table}</DialogDescription>
              </DialogHeader>

              <FieldGroup>
                {fields.map(([name, m]) => {
                  const label = `${name}${m.optional ? '' : ' *'}`
                  const kind = m.kind

                  if (kind === 'boolean') {
                    return (
                      <Field key={name} orientation="horizontal">
                        <FieldTitle>{label}</FieldTitle>
                        <FieldContent>
                          <Switch checked={Boolean(createDraft[name] ?? false)} onCheckedChange={(checked) => setCreateDraft((d) => ({...d, [name]: coerceDbAdminFieldInput(kind, '', checked)}))} />
                        </FieldContent>
                      </Field>
                    )
                  }

                  if (kind === 'unknown' || kind === 'object' || kind === 'array' || kind === 'record' || kind === 'union') {
                    if (name === 'tags' && kind === 'array' && 'of' in m && m.of.kind === 'string') {
                      const current = createDraft[name]
                      return (
                        <Field key={name}>
                          <FieldTitle>{label}</FieldTitle>
                          <FieldContent>
                            <Input
                              value={formatCsvTags(current)}
                              onChange={(e) => {
                                const raw = e.target.value
                                setCreateDraft((d) => ({...d, [name]: raw}))
                              }}
                              placeholder="comma-separated tags (e.g. nextjs, convex, cli)"
                            />
                          </FieldContent>
                        </Field>
                      )
                    }
                    return (
                      <Field key={name}>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldContent>
                          <Textarea value={typeof createDraft[name] === 'string' ? (createDraft[name] as string) : formatDbAdminCellValue(createDraft[name] ?? '')} onChange={(e) => setCreateDraft((d) => ({...d, [name]: e.target.value}))} placeholder="JSON / text" />
                        </FieldContent>
                      </Field>
                    )
                  }

                  if (kind === 'enum' && 'values' in m) {
                    const selected = typeof createDraft[name] === 'string' ? (createDraft[name] as string) : null
                    return (
                      <Field key={name}>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldContent>
                          <Select value={selected} onValueChange={(val) => setCreateDraft((d) => ({...d, [name]: val ?? undefined}))}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={`Select ${name}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {m.values.map((val) => (
                                <SelectItem key={String(val)} value={String(val)}>
                                  {String(val)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldContent>
                      </Field>
                    )
                  }

                  return (
                    <Field key={name}>
                      <FieldTitle>{label}</FieldTitle>
                      <FieldContent>
                        <Input type={kind === 'number' ? 'number' : 'text'} value={typeof createDraft[name] === 'string' ? (createDraft[name] as string) : String(createDraft[name] ?? '')} onChange={(e) => setCreateDraft((d) => ({...d, [name]: coerceDbAdminFieldInput(kind, e.target.value)}))} />
                      </FieldContent>
                    </Field>
                  )
                })}
              </FieldGroup>

              <DialogFooter>
                <Button onClick={onCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex flex-wrap items-baseline gap-x-1.25 text-xl font-semibold tracking-tight">
              <span>{tableTitle}</span>
              <span className="text-muted-foreground">Data</span>
            </CardTitle>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{Object.keys(meta.fields).length} fields</Badge>
              <Badge variant="secondary">{results.length} items</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {status === 'LoadingFirstPage' ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : results.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No rows yet</EmptyTitle>
                <EmptyDescription>Create the first document for `{table}`.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-xl border">
              <Table className="min-w-max text-sm">
                <TableHeader className="bg-muted/40 h-fit">
                  <TableRow>
                    {columnNames.map((c) => (
                      <TableHead key={c} className="text-muted-foreground/80">
                        {c}
                      </TableHead>
                    ))}
                    <TableHead className="sticky right-0 z-20 w-0 min-w-18 text-right text-muted-foreground/80" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(results as DatabaseDocument[]).map((row) => (
                    <TableRow key={row._id} className="cursor-pointer" onClick={() => openView(row)}>
                      {columnNames.map((c) => {
                        const value = c === '_creationTime' ? row._creationTime : (row as Record<string, unknown>)[c]
                        const rendered = renderCell({table, column: c, row, value})
                        return <Fragment key={c}>{rendered}</Fragment>
                      })}
                      <TableCell onClick={(e) => e.stopPropagation()} className="sticky right-0 z-10">
                        <div className="flex items-center justify-end">
                          <ButtonGroup className="overflow-hidden rounded-lg border border-border bg-background">
                            <Dialog open={editRow?._id === row._id} onOpenChange={(open) => (open ? openEdit(row) : setEditRow(null))}>
                              <DialogTrigger
                                render={
                                  <Button variant="outline" size="icon-sm" className={cn(tableRowActionBtnClass, tableRowActionIconClass, 'bg-background hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50')} aria-label="Edit">
                                    <PencilIcon aria-hidden />
                                  </Button>
                                }
                              />
                              <DialogContent showCloseButton>
                                <DialogHeader>
                                  <DialogTitle>Edit</DialogTitle>
                                  <DialogDescription>{row._id}</DialogDescription>
                                </DialogHeader>

                                {!editRow ? null : (
                                  <FieldGroup>
                                    {fields.map(([name, m]) => {
                                      const label = `${name}${m.optional ? '' : ' *'}`
                                      const kind = m.kind
                                      const current = editRow[name]
                                      const draft = editDraft[name]
                                      const value = draft !== undefined ? draft : current

                                      if (kind === 'boolean') {
                                        return (
                                          <Field key={name} orientation="horizontal">
                                            <FieldTitle>{label}</FieldTitle>
                                            <FieldContent>
                                              <Switch checked={Boolean(value ?? false)} onCheckedChange={(checked) => setEditDraft((d) => ({...d, [name]: coerceDbAdminFieldInput(kind, '', checked)}))} />
                                            </FieldContent>
                                          </Field>
                                        )
                                      }

                                      if (kind === 'unknown' || kind === 'object' || kind === 'array' || kind === 'record' || kind === 'union') {
                                        if (name === 'tags' && kind === 'array' && 'of' in m && m.of.kind === 'string') {
                                          return (
                                            <Field key={name}>
                                              <FieldTitle>{label}</FieldTitle>
                                              <FieldContent>
                                                <Input
                                                  value={formatCsvTags(value)}
                                                  onChange={(e) => {
                                                    const raw = e.target.value
                                                    setEditDraft((d) => ({...d, [name]: raw}))
                                                  }}
                                                  placeholder="comma-separated tags (e.g. nextjs, convex, cli)"
                                                />
                                              </FieldContent>
                                            </Field>
                                          )
                                        }
                                        return (
                                          <Field key={name}>
                                            <FieldTitle>{label}</FieldTitle>
                                            <FieldContent>
                                              <Textarea value={typeof value === 'string' ? value : formatDbAdminCellValue(value ?? '')} onChange={(e) => setEditDraft((d) => ({...d, [name]: e.target.value}))} placeholder="JSON / text" />
                                            </FieldContent>
                                          </Field>
                                        )
                                      }

                                      if (kind === 'enum' && 'values' in m) {
                                        const selected = typeof value === 'string' ? value : null
                                        return (
                                          <Field key={name}>
                                            <FieldTitle>{label}</FieldTitle>
                                            <FieldContent>
                                              <Select value={selected} onValueChange={(val) => setEditDraft((d) => ({...d, [name]: val ?? undefined}))}>
                                                <SelectTrigger className="w-full">
                                                  <SelectValue placeholder={`Select ${name}`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {m.values.map((val) => (
                                                    <SelectItem key={String(val)} value={String(val)}>
                                                      {String(val)}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </FieldContent>
                                          </Field>
                                        )
                                      }

                                      return (
                                        <Field key={name}>
                                          <FieldTitle>{label}</FieldTitle>
                                          <FieldContent>
                                            <Input type={kind === 'number' ? 'number' : 'text'} value={typeof value === 'string' ? value : String(value ?? '')} onChange={(e) => setEditDraft((d) => ({...d, [name]: coerceDbAdminFieldInput(kind, e.target.value)}))} />
                                          </FieldContent>
                                        </Field>
                                      )
                                    })}
                                  </FieldGroup>
                                )}

                                <DialogFooter>
                                  <Button onClick={onUpdate}>Save</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button variant="destructive" size="icon-sm" className={cn(tableRowActionBtnClass, tableRowActionIconClass)} aria-label="Delete">
                                    <TrashIcon aria-hidden />
                                  </Button>
                                }
                              />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete row?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onRemove(row._id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </ButtonGroup>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {status === 'CanLoadMore' && (
            <div className="flex items-center justify-center pt-4">
              <Button variant="outline" disabled={isLoading} onClick={() => loadMore(PAGE_SIZE)}>
                {isLoading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewRow} onOpenChange={(open) => (!open ? setViewRow(null) : null)}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            'flex flex-col gap-0 overflow-hidden p-0',
            'max-h-[min(40rem,85dvh)] xl:max-h-[min(34rem,82dvh)] sm:max-h-[90dvh]',
          )}
        >
          <DialogClose
            render={
              <Button variant="ghost" className="absolute top-2 right-2 z-20 font-mono text-lg leading-none" size="icon-sm" aria-label="Close">
                <span aria-hidden>×</span>
                <span className="sr-only">Close</span>
              </Button>
            }
          />

          <DialogHeader className="sticky top-0 z-10 border-b bg-popover/95 px-4 py-3 pr-12 backdrop-blur-sm sm:px-3">
            <DialogTitle>View</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">{viewRow?._id}</DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              'overflow-y-auto overscroll-contain px-4 py-4 sm:px-3',
              'max-h-[calc(min(40rem,85dvh)-4.5rem)]',
              'xl:max-h-[calc(min(34rem,82dvh)-4.5rem)]',
              'sm:max-h-[calc(90dvh-4rem)]',
            )}
          >
            {!viewRow ? null : (
              <FieldGroup>
                <Field className="gap-1.25">
                  <FieldTitle>_id</FieldTitle>
                  <FieldContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-normal">
                        {viewRow._id}
                      </Badge>
                    </div>
                  </FieldContent>
                </Field>

                {Object.keys(meta.fields).map((name) => {
                  const value = (viewRow as Record<string, unknown>)[name]
                  const custom = cellRendererByColumn[name]
                  return (
                    <Field className="gap-1.25" key={name}>
                      <FieldTitle>{name}</FieldTitle>
                      <FieldContent>{custom ? <div className="flex min-h-9 items-center">{custom({table, column: name, row: viewRow, value})}</div> : <div className="whitespace-pre-wrap wrap-break-word font-mono text-xs text-muted-foreground">{formatDbAdminCellValue(value)}</div>}</FieldContent>
                    </Field>
                  )
                })}

                <Field className="gap-1.25">
                  <FieldTitle>_creationTime</FieldTitle>
                  <FieldContent>
                    <div className="font-mono text-xs text-muted-foreground">{formatConvexCreationTime(viewRow._creationTime)}</div>
                  </FieldContent>
                </Field>
              </FieldGroup>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  )
}

function UnknownTablePage({slug}: {slug: string}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Unknown table</CardTitle>
          <CardDescription>Table `{slug}` is not present in generated meta.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Link href="/db">
            <Button variant="outline">Back to /db</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function DatabaseItemPage() {
  const params = useParams<{slug: string}>()
  return isDbTable(params.slug) ? <DatabaseTablePageInner slug={params.slug} /> : <UnknownTablePage slug={params.slug} />
}
