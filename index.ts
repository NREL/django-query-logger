import os from 'node:os'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import fastifyWebsocket from '@fastify/websocket'
import Fastify from 'fastify'
import {Parser} from 'pickleparser'
import {WebSocket} from 'ws'
import {ActionMessage, Message, Queries, Query, Stats} from './ui/src/app/types'
import {chunkArray} from './utils'

type BackendLog = {
  created: number;
  duration: number;
  sql: string;
}

const parser = new Parser()
let queries: Queries = []

process.on('uncaughtException', async (error) => {
  console.error(error)
})

// Socket server
Bun.listen({
  hostname: 'localhost',
  port: 9999,
  socket: {
    data(_socket, data) {
      // Multiple messages can be in a single packet
      let offset = 0
      while (offset < data.length) {
        const messageLength = data.readUInt32BE(offset)
        offset += 4
        const pickledData = data.subarray(offset, offset + messageLength)
        offset += messageLength

        try {
          const {created, duration, sql}: BackendLog = parser.parse(pickledData)
          const query: Query = {
            id: queries.length + 1,
            timestamp: Math.round(created * 1000),
            duration: parseFloat(duration.toFixed(3)),
            sql: sql.trim(),
          }
          queries.push(query)

          const msg = JSON.stringify({
            type: 'queries',
            data: [query],
          } satisfies Message)
          for (const client of fastify.websocketServer.clients) {
            if (client.readyState === 1) {
              client.send(msg)
            }
          }
        } catch (error) {
          console.error('Failed to unpickle message')
        }
      }
    },
    error(socket, error) {
      console.error('Socket error:', error)
    },
  },
})

// Randomly shuffles the queries using the Fisher-Yates algorithm
const shuffleQueries = <T>(array: T[]) => {
  const queries = [...array]
  for (let i = queries.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[queries[i], queries[j]] = [queries[j], queries[i]] // Swap elements
  }
  return queries
}

// TODO incorporate filtering
const calculateStats = async (client: WebSocket) => {
  const maxCores = Math.max(os.cpus().length - 4, 2)
  const shuffledQueries = shuffleQueries(queries)
  const total = shuffledQueries.length
  const chunks = chunkArray(shuffledQueries.map(({sql}) => sql), Math.max(Math.ceil(queries.length / maxCores), 10))

  const workers: Worker[] = []

  while (workers.length < chunks.length) {
    await new Promise<void>((resolve) => {
      const worker = new Worker('./stats-worker.ts')

      const onEarlyTermination = () => {
        // Terminating just in case it helps free memory
        worker.terminate()
        resolve()
      }

      worker.addEventListener('open', () => {
        workers.push(worker)
        resolve()
        worker.removeEventListener('close', onEarlyTermination)
      })

      worker.addEventListener('close', onEarlyTermination)
    })
  }

  let completed = 0
  const results = (await Promise.all(
    workers.map((worker, index) => {
      const id = index + 1
      return new Promise<Stats[]>((resolve) => {
        worker.onmessage = (e) => {
          if (!e.data) {
            ++completed
            client.send(JSON.stringify({
              type: 'stats-progress',
              data: [completed, total],
            } satisfies Message))
          } else {
            // Terminating just in case it helps free memory
            worker.terminate()
            resolve(e.data)
          }
        }
        worker.postMessage({
          id,
          queries: chunks[index],
        })
      })
    }),
  )).flat()

  const stats = results.reduce<Stats>((stats, stat) => {
    for (const keyword of Object.keys(stat)) {
      if (!stats[keyword]) stats[keyword] = {}

      for (const table of Object.keys(stat[keyword])) {
        stats[keyword][table] = (stats[keyword][table] ?? 0) + stat[keyword][table]
      }
    }
    return stats
  }, {})

  client.send(JSON.stringify({
    type: 'stats',
    data: stats,
  } satisfies Message))
}

// Web/WebSocket server
const limit = 104_857_600 // 100 MiB

const fastify = Fastify({
  bodyLimit: limit,
  logger: false,
})
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public', 'browser'),
})
fastify.register(fastifyWebsocket, {
  options: {maxPayload: limit},
})
fastify.setNotFoundHandler((_request, reply) => {
  reply.sendFile('index.html')
})

fastify.register(async () => {
  fastify.route({
    method: 'GET',
    url: '/',
    handler: (_req, reply) => {
      reply.sendFile('index.html')
    },
    wsHandler: (socket) => {
      socket.send(JSON.stringify({
        type: 'queries',
        data: queries,
      } satisfies Message))
      socket.on('message', (message) => {
        try {
          const msg: ActionMessage = JSON.parse(message.toString())
          switch (msg.action) {
            case 'clear':
              // TODO send clear action to all clients that aren't the one that sent "clear"
              queries = []
              break
            case 'stats':
              calculateStats(socket)
              break
          }
        } catch (e) {
          console.error('Caught error', e)
        }
      })
    },
  })
})

fastify.listen({host: 'localhost', port: 3000}, (err, address) => {
  if (err) throw err
  console.log('Django Query Logger ready: http://localhost:3000/')
})
