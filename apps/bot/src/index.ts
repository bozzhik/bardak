import {createBot} from './telegram-bot.js'

const bot = createBot()
await bot.start()
console.log('Bot started in long-polling mode')
