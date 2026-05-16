import {ConvexHttpClient} from 'convex/browser'
import {FileAudio, FileText, FileVideo, ImageIcon, LinkIcon, MessageSquareText, Send, Sticker, Tag, type LucideIcon} from 'lucide-react'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {api} from '@/lib/convex'
import {cn} from '@/lib/utils'

import Container from '~/global/container'
import {Badge} from '~/primitives/badge'
import {Button} from '~/primitives/button'
import {Card, CardContent, CardHeader, CardTitle} from '~/primitives/card'
import {H1, Muted, P, Span, SpanMuted} from '~/primitives/typography'

const TELEGRAM_BOT_URL = 'https://t.me/bardak_ai_bot?start=SHARE_PAGE'

type PublicPageProps = {
  params: Promise<{
    slug: string
  }>
}

type PublicPage = Extract<Awaited<ReturnType<typeof getPublicPage>>, {status: 'found'}>
type PublicEntry = PublicPage['entries'][number]
type EntryKind = PublicEntry['kind']

const KIND_META: Record<EntryKind, {label: string; icon: LucideIcon; className: string}> = {
  text: {label: 'text', icon: MessageSquareText, className: 'text-sky-300 border-sky-400/25 bg-sky-400/8'},
  link: {label: 'link', icon: LinkIcon, className: 'text-cyan-300 border-cyan-400/25 bg-cyan-400/8'},
  photo: {label: 'photo', icon: ImageIcon, className: 'text-lime-300 border-lime-400/25 bg-lime-400/8'},
  voice: {label: 'voice', icon: FileAudio, className: 'text-violet-300 border-violet-400/25 bg-violet-400/8'},
  audio: {label: 'audio', icon: FileAudio, className: 'text-fuchsia-300 border-fuchsia-400/25 bg-fuchsia-400/8'},
  document: {label: 'document', icon: FileText, className: 'text-amber-300 border-amber-400/25 bg-amber-400/8'},
  video: {label: 'video', icon: FileVideo, className: 'text-rose-300 border-rose-400/25 bg-rose-400/8'},
  sticker: {label: 'sticker', icon: Sticker, className: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/8'},
  unsupported: {label: 'unsupported', icon: FileText, className: 'text-muted-foreground border-border bg-muted/20'},
}

function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
}

async function getPublicPage(shareSlug: string) {
  return await getConvexClient().query(api.tables.pages.getPublicBySlug, {shareSlug})
}

export async function generateMetadata({params}: PublicPageProps): Promise<Metadata> {
  const {slug} = await params
  const page = await getPublicPage(slug)
  if (page.status !== 'found') return {}

  return {
    title: page.page.title,
    description: `Публичная подборка Bardak по тегу #${page.tag.name}`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function SharePage({params}: PublicPageProps) {
  const {slug} = await params
  const page = await getPublicPage(slug)
  if (page.status !== 'found') notFound()

  return (
    <Container className="w-[46rem] xl:w-[42rem] sm:w-[94vw]! py-6 sm:py-4">
      <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-5 sm:flex-col">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 rounded-sm border-border/80 bg-muted/20">
              <Tag className="size-3" />
              {page.tag.name}
            </Badge>
            <SpanMuted>
              {page.entries.length}
              {page.isTruncated ? '+' : ''} материалов
            </SpanMuted>
          </div>

          <H1 className="text-left text-3xl font-semibold tracking-normal sm:text-2xl">{page.page.title}</H1>
          <Muted className="max-w-[40rem] leading-5">Живая публичная страница тега. Новые материалы с этим тегом появляются здесь автоматически.</Muted>
        </div>

        <Button variant="outline" size="sm" nativeButton={false} render={<a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" />}>
          <Send />
          Bardak
        </Button>
      </header>

      <section className="space-y-3">
        {page.entries.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-card/70 p-5">
            <P className="m-0 text-muted-foreground">Активных материалов пока нет.</P>
          </div>
        ) : (
          page.entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
        )}
      </section>

      {page.isTruncated && <Muted className="border-t border-border/70 pt-4">Показаны первые 100 новых материалов. Остальное появится после будущего load more.</Muted>}

      <footer className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 sm:flex-col sm:items-start">
        <SpanMuted>Собрано в Bardak</SpanMuted>
        <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
          <Span>Открыть бота</Span>
        </a>
      </footer>
    </Container>
  )
}

function EntryCard({entry}: {entry: PublicEntry}) {
  const meta = KIND_META[entry.kind]
  const Icon = meta.icon
  const primaryText = entry.text ?? entry.description ?? entry.url ?? mediaFallback(entry)
  const metadata = entryMetadata(entry)

  return (
    <Card className="rounded-lg border border-border/40 bg-card/80 py-0 shadow-none" size="sm">
      <CardHeader className="border-b border-border/50 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border', meta.className)}>
            <Icon className="size-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-medium">{meta.label}</CardTitle>
              <SpanMuted>{formatDate(entry.createdAt)}</SpanMuted>
            </div>
            <EntryText entry={entry} text={primaryText} />
          </div>
        </div>
      </CardHeader>

      {metadata.length > 0 && (
        <CardContent className="flex flex-wrap gap-2 py-3">
          {metadata.map((item) => (
            <Badge key={item} variant="secondary" className="max-w-full justify-start truncate rounded-sm font-normal">
              {item}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

function EntryText({entry, text}: {entry: PublicEntry; text: string}) {
  if (entry.url !== null) {
    return (
      <a href={entry.url} target="_blank" rel="noopener noreferrer" className="block text-foreground transition-colors hover:text-muted-foreground">
        <P className="m-0 line-clamp-3 break-words leading-6">{text}</P>
      </a>
    )
  }

  return <P className="m-0 line-clamp-4 break-words leading-6">{text}</P>
}

function mediaFallback(entry: PublicEntry): string {
  if (entry.kind === 'photo') return '[photo]'
  if (entry.kind === 'voice') return '[voice]'
  if (entry.kind === 'audio') return '[audio]'
  if (entry.kind === 'document') return '[document]'
  if (entry.kind === 'video') return '[video]'
  if (entry.kind === 'sticker') return entry.telegram.file.emoji ?? '[sticker]'
  return '[unsupported]'
}

function entryMetadata(entry: PublicEntry): string[] {
  const {file, context} = entry.telegram
  return [file.fileName, file.mimeType, file.fileSize === null ? null : formatFileSize(file.fileSize), file.duration === null ? null : formatDuration(file.duration), file.width === null || file.height === null ? null : `${file.width}x${file.height}`, file.emoji, file.setName === null ? null : `set ${file.setName}`, context.forwardOrigin === null ? null : `forward ${context.forwardOrigin}`].filter((value): value is string => value !== null && value.length > 0)
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
