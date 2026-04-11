import {type ComponentProps} from 'react'
import {cn} from '@/lib/utils'

export function H1({className, children, ...props}: ComponentProps<'h1'>) {
  return (
    <h1 className={cn('scroll-m-20 text-center font-extrabold tracking-tight text-balance', 'text-4xl xl:text-3xl sm:text-2xl', className)} {...props}>
      {children}
    </h1>
  )
}

export function H2({className, children, ...props}: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('scroll-m-20 border-b pb-2 font-semibold tracking-tight first:mt-0', 'text-3xl xl:text-2xl sm:text-xl', className)} {...props}>
      {children}
    </h2>
  )
}

export function H3({className, children, ...props}: ComponentProps<'h3'>) {
  return (
    <h3 className={cn('scroll-m-20 font-semibold tracking-tight', 'text-2xl xl:text-xl sm:text-lg', className)} {...props}>
      {children}
    </h3>
  )
}

export function H4({className, children, ...props}: ComponentProps<'h4'>) {
  return (
    <h4 className={cn('scroll-m-20 font-semibold tracking-tight', 'text-xl xl:text-lg sm:text-base', className)} {...props}>
      {children}
    </h4>
  )
}

export function P({className, children, ...props}: ComponentProps<'p'>) {
  return (
    <p className={cn('leading-7 not-first:mt-6', 'text-base sm:text-sm', className)} {...props}>
      {children}
    </p>
  )
}

export function Blockquote({className, children, ...props}: ComponentProps<'blockquote'>) {
  return (
    <blockquote className={cn('mt-6 border-l-2 pl-6 italic', 'pl-4 sm:pl-3', className)} {...props}>
      {children}
    </blockquote>
  )
}

export function Table({className, children, ...props}: ComponentProps<'table'>) {
  return (
    <div className="my-6 w-full overflow-x-auto">
      <table className={cn('w-full border-collapse', '[&_th]:border [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th[align=center]]:text-center [&_th[align=right]]:text-right', '[&_td]:border [&_td]:px-4 [&_td]:py-2 [&_td]:text-left [&_td[align=center]]:text-center [&_td[align=right]]:text-right', '[&_tr]:m-0 [&_tr]:border-t [&_tr]:p-0 [&>tbody>tr:nth-child(even)]:bg-muted', 'sm:[&_th]:px-2 sm:[&_th]:py-1.5 sm:[&_td]:px-2 sm:[&_td]:py-1.5', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function List({className, children, ...props}: ComponentProps<'ul'>) {
  return (
    <ul className={cn('my-6 ml-6 list-disc [&>li]:mt-2 sm:ml-4', className)} {...props}>
      {children}
    </ul>
  )
}

export function ListItem({className, children, ...props}: ComponentProps<'li'>) {
  return (
    <li className={cn(className)} {...props}>
      {children}
    </li>
  )
}

export function Code({className, children, ...props}: ComponentProps<'code'>) {
  return (
    <code className={cn('bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono font-semibold', 'text-sm sm:text-xs', className)} {...props}>
      {children}
    </code>
  )
}

export function Lead({className, children, ...props}: ComponentProps<'p'>) {
  return (
    <p className={cn('text-muted-foreground', 'text-xl xl:text-lg sm:text-base', className)} {...props}>
      {children}
    </p>
  )
}

export function Large({className, children, ...props}: ComponentProps<'div'>) {
  return (
    <div className={cn('font-semibold', 'text-lg xl:text-base sm:text-sm', className)} {...props}>
      {children}
    </div>
  )
}

export function Small({className, children, ...props}: ComponentProps<'small'>) {
  return (
    <small className={cn('text-sm leading-none font-medium sm:text-xs', className)} {...props}>
      {children}
    </small>
  )
}

export function Muted({className, children, ...props}: ComponentProps<'p'>) {
  return (
    <p className={cn('text-muted-foreground text-sm sm:text-xs', className)} {...props}>
      {children}
    </p>
  )
}

/** Inline span, adaptive text size. Use for inline text, captions, labels. */
export function Span({className, children, ...props}: ComponentProps<'span'>) {
  return (
    <span className={cn('text-sm sm:text-xs', className)} {...props}>
      {children}
    </span>
  )
}

/** Muted inline span, same adaptive sizes. */
export function SpanMuted({className, children, ...props}: ComponentProps<'span'>) {
  return (
    <span className={cn('text-muted-foreground text-sm sm:text-xs', className)} {...props}>
      {children}
    </span>
  )
}
