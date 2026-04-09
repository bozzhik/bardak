import {cn} from '@/lib/utils'

export const BOX = {
  container: 'w-[30vw] xl:w-[40vw] sm:w-[95vw]! py-4 mx-auto',
  display: 'flex-1 space-y-4.5',
}

export default function Container({children, className}: {children: React.ReactNode; className?: string}) {
  return <main className={cn(BOX.container, BOX.display, className)}>{children}</main>
}
