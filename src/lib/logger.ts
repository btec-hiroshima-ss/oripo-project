import pino from 'pino'

const LOG_BASE = process.env.LOG_FILE ?? '/var/log/app/app'

const transport = pino.transport({
  targets: [
    { target: 'pino/file', options: { destination: 1 } }, // stdout
    { target: 'pino-roll', options: { file: LOG_BASE, frequency: 'daily', mkdir: true } },
  ],
})

export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, transport)
