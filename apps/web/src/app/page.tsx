'use client'

import {useMutation} from 'convex/react'
import {Mic, Search, Send, Share2, Tag, Zap, Bot} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'

import {api} from '@/lib/convex'
import {cn} from '@/lib/utils'

import Container from '~/global/container'
import {InputGroup, InputGroupInput, InputGroupAddon, InputGroupText} from '~/ui/input-group'

const TELEGRAM_BOT_URL = 'https://t.me/bardak_ai_bot?start=DEMO_WEBSITE'

const DEMO_VERSION = true

export default function IndexPage() {
  const submitWaitlist = useMutation(api.tables.waitlist.submit)
  const [telegramUsername, setTelegramUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleWaitlistSubmit() {
    const trimmed = telegramUsername.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await submitWaitlist({username: trimmed})
      if (result.status === 'created') {
        toast.success('Вы в списке. Напишем в Telegram, когда откроем ранний доступ.')
        setTelegramUsername('')
      } else if (result.status === 'duplicate') {
        toast.message('Этот ник уже в списке ожидания.')
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Не удалось отправить. Попробуйте позже.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Container className={cn('py-[8vh] xl:py-[6vh] sm:pt-[4vh] sm:pb-[8vh]', 'space-y-8 xl:space-y-7 sm:space-y-9')}>
      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:gap-5">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl leading-none! font-semibold tracking-[-0.03em]">Bardak</h1>
          <span className="mt-1 size-5 rounded-full bg-[#8D8D8D] animate-pulse" />
        </div>

        {!DEMO_VERSION && (
          <Button href={TELEGRAM_BOT_URL} variant="secondary" className="sm:hidden">
            Перейти
          </Button>
        )}
      </div>

      <div className="space-y-7 xl:space-y-6">
        <Text>Этот бот приводит в порядок всё, что ты сохраняешь в Телеграме — в Избранном, в личных чатах и в приватных группах. Где бы ни копились мысли и ссылки, всё становится понятно и легко найти.</Text>

        <Text>Ты просто продолжаешь пользоваться Телеграмом как обычно. Заметки, голосовые, ссылки, файлы бот систематизирует, чтобы нужное находилось сразу, а не после долгого скролла.</Text>

        <Text>
          Подключить можно за минуту через{' '}
          <InlineBadge href={TELEGRAM_BOT_URL} accent="text-[#20A3E1]" icon="send">
            бота в телеграме
          </InlineBadge>
          . Веб помогает редактировать, искать и делиться подборками.
        </Text>

        <div className="space-y-5 xl:space-y-4">
          <Text>
            <span>Как это работает</span>
          </Text>

          <div className="space-y-3.5">
            <Text>
              <Tag className="mr-2 inline size-[16px] -translate-y-px text-yellow-400" />
              Бот сразу просит тег и новые материалы не теряются в ленте.
            </Text>

            <Text>
              <Mic className="mr-2 inline size-[16px] -translate-y-px text-indigo-400" />
              Голосовые автоматически превращаются в текст.
            </Text>

            <Text>
              <Search className="mr-2 inline size-[16px] -translate-y-px text-pink-400" />
              Нужное можно быстро найти по тегам, тексту и типу контента.
            </Text>

            <Text>
              <Share2 className="mr-2 inline size-[16px] -translate-y-px text-lime-400" />
              Из материалов можно собрать страницу и поделиться ею.
            </Text>
          </div>
        </div>

        <Text>
          Когда{' '}
          <InlineBadge accent="text-[#FF7C1D]!" icon="zap">
            «сохраню на потом»
          </InlineBadge>{' '}
          превращается в бесконечный архив, Bardak возвращает контроль. Нужное находится быстро, важное не теряется и всё выглядит аккуратно.
        </Text>
      </div>

      <div className="space-y-5 xl:space-y-4">
        <Text>
          Будьте среди первых, кто попробует{' '}
          <InlineBadge accent="text-pink-400!" icon="bot">
            Bardak
          </InlineBadge>{' '}
          в деле. Оставьте свой Telegram-ник — мы напишем, когда откроем ранний доступ.
        </Text>

        <div data-slot="waitlist-input" className="flex gap-2 sm:flex-col">
          <InputGroup className="min-w-0 flex-1 h-8.5 rounded-sm">
            <InputGroupInput
              placeholder="username"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value.replace(/@/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleWaitlistSubmit()
              }}
              disabled={isSubmitting}
              autoComplete="off"
              inputMode="text"
              className="flex-1 pl-0.75! pt-0.75! sm:pt-0.75! placeholder:font-medium placeholder:text-neutral-500"
            />

            <InputGroupAddon>
              <InputGroupText>
                t.me <span className="-ml-1.25!">/</span>
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>

          <button type="button" onClick={() => void handleWaitlistSubmit()} disabled={!telegramUsername.trim() || isSubmitting} className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 py-1.5 px-4.5 rounded-sm border border-neutral-400/50 bg-neutral-500 text-sm font-medium tracking-[-0.01em] text-white shadow-[0_12px_26px_rgba(119,119,119,0.015)] transition-all duration-200 hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 sm:w-full')}>
            {isSubmitting ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>

      {!DEMO_VERSION && (
        <Button href={TELEGRAM_BOT_URL} variant="primary">
          Начать использовать
        </Button>
      )}
    </Container>
  )
}

function Text({children, className}: {children: React.ReactNode; className?: string}) {
  return <p className={cn('text-lg xl:text-base leading-[1.4]! font-medium tracking-[-0.015em] text-[#8D8D8D] [&>span]:text-white', className)}>{children}</p>
}

const INLINE_BADGE_ICONS = {send: Send, zap: Zap, bot: Bot} as const

type InlineBadgeIcon = keyof typeof INLINE_BADGE_ICONS

function InlineBadge({href, accent, icon, children}: {href?: string; accent: string; icon?: InlineBadgeIcon; children: React.ReactNode}) {
  const Icon = icon ? INLINE_BADGE_ICONS[icon] : null
  const content = (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-200', accent)}>
      {Icon && <Icon className={cn('size-3.5 xl:-mt-1')} />}
      {children}
    </span>
  )

  if (!href) return content

  return (
    <a href={href} className="group">
      <span className="inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-200 group-hover:text-[#8D8D8D]">{content}</span>
    </a>
  )
}

const BUTTON_VARIANTS = {
  // primary: 'py-1.75 px-3.5 w-full rounded-sm border border-neutral-700/80 bg-neutral-900/90 text-sm text-white shadow-[0_0_24px_rgba(68,118,165,0.08)] hover:border-[#41586F] hover:text-[#E7F3FF]',
  primary: 'py-1.5 px-4.5 w-full rounded-sm border border-[#333] bg-[linear-gradient(180deg,#777,#444)] text-sm text-white shadow-[0_12px_26px_rgba(119,119,119,0.015)] hover:brightness-110',
  secondary: 'py-1 sm:py-1.5 px-3.5 sm:w-full rounded-sm border border-neutral-700/50 bg-neutral-900/70 text-[13px] sm:text-sm text-neutral-300 shadow-[0_0_24px_rgba(119,119,119,0.05)] hover:border-[#41586F] hover:text-[#E7F3FF]',
} as const

type ButtonVariants = keyof typeof BUTTON_VARIANTS

function Button({variant, href, className, children}: {variant: ButtonVariants; href: string; className?: string; children: React.ReactNode}) {
  const isSolid = variant.endsWith('solid')
  return (
    <a href={href} className={cn('inline-flex items-center justify-center gap-1.5 font-medium tracking-[-0.01em] transition-all duration-200', BUTTON_VARIANTS[variant], className)} target="_blank" rel="noopener noreferrer">
      <Send className={cn('size-[13px]', isSolid ? 'opacity-95' : 'opacity-78')} />
      {children}
    </a>
  )
}
