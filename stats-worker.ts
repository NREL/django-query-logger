import {astVisitor, parseFirst} from 'pgsql-ast-parser'
import {Stats} from './ui/src/app/types'

// prevents TS errors
declare var self: Worker

const ignoreRe = /^(RELEASE )?SAVEPOINT ".+"$/

self.onmessage = ({data: {id, queries}}: MessageEvent) => {
  let currentType = ''
  const results: Stats = {}

  const visitor = astVisitor(() => ({
    tableRef: ({name}) => {
      if (!results[currentType]) results[currentType] = {}
      results[currentType][name] = (results[currentType][name] ?? 0) + 1
    },
  }))

  for (const query of queries) {
    try {
      if (!ignoreRe.test(query)) {
        const ast = parseFirst(query.replace(/^DECLARE "_django_curs_\d+_sync_\d+" NO SCROLL CURSOR WITH(OUT)? HOLD FOR /, ''))
        currentType = ast.type
        visitor.statement(ast)
      }
    } catch (e) {
      console.error(`Failed to process query '${query}'`)
    } finally {
      // Send a null message for progress
      postMessage(null)
    }
  }

  postMessage(results)
  process.exit()
}
