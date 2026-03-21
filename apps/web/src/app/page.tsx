import {hello} from '@repo/shared'

export default function IndexPage() {
  console.log(hello('web'))

  return <main>{hello('web')}</main>
}
