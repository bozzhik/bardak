import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

/**
 * Minimal schema parser for Convex `defineSchema({ table: defineTable({...}) })`.
 * Generates / updates:
 * - src/lib/db/meta.generated.ts (UI meta)
 * - src/lib/db/registry.generated.ts (table list + api mapping)
 * - convex/tables/<table>.ts — ONLY the region between:
 *   // db-gen:base:start
 *   // db-gen:base:end
 *
 * Notes:
 * - Put your own exports outside that region; the script never touches them.
 * - If a table file is missing, it is created with imports + markers + base exports.
 */

const repoRoot = process.cwd()
const schemaPath = path.join(repoRoot, 'convex', 'schema.ts')
const tablesDir = path.join(repoRoot, 'convex', 'tables')
const outMetaPath = path.join(repoRoot, 'src', 'lib', 'db', 'meta.generated.ts')
const outRegistryPath = path.join(repoRoot, 'src', 'lib', 'db', 'registry.generated.ts')

const MARK_START = '// db-gen:base:start'
const MARK_END = '// db-gen:base:end'

function die(message) {
  console.error(`[gen-db-meta] ${message}`)
  process.exit(1)
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true})
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function printNode(node, sourceFile) {
  return node.getText(sourceFile)
}

function isCall(node, name) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
}

function isVCall(node, methodName) {
  // v.string(), v.optional(...), etc.
  return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'v' && node.expression.name.text === methodName
}

function unwrapOptional(validatorExpr, sourceFile) {
  if (isVCall(validatorExpr, 'optional')) {
    const inner = validatorExpr.arguments[0]
    if (!inner) die(`v.optional() without argument: ${printNode(validatorExpr, sourceFile)}`)
    return {optional: true, inner}
  }
  return {optional: false, inner: validatorExpr}
}

function kindFromValidator(expr, sourceFile) {
  // Returns a small JSON-able meta description for UI purposes.
  // This is not meant to be a complete Convex type system.

  if (isVCall(expr, 'optional')) {
    const inner = expr.arguments[0]
    if (!inner) die(`v.optional() without argument: ${printNode(expr, sourceFile)}`)
    const innerMeta = kindFromValidator(inner, sourceFile)
    return {...innerMeta, optional: true}
  }

  if (isVCall(expr, 'string')) return {kind: 'string', optional: false}
  if (isVCall(expr, 'number')) return {kind: 'number', optional: false}
  if (isVCall(expr, 'boolean')) return {kind: 'boolean', optional: false}
  if (isVCall(expr, 'int64')) return {kind: 'int64', optional: false}
  if (isVCall(expr, 'bytes')) return {kind: 'bytes', optional: false}
  if (isVCall(expr, 'null')) return {kind: 'null', optional: false}

  if (isVCall(expr, 'id')) {
    const arg = expr.arguments[0]
    if (!arg || !ts.isStringLiteral(arg)) die(`v.id() must be v.id('table'): ${printNode(expr, sourceFile)}`)
    return {kind: 'id', table: arg.text, optional: false}
  }

  if (isVCall(expr, 'literal')) {
    const arg = expr.arguments[0]
    if (!arg) die(`v.literal() missing argument: ${printNode(expr, sourceFile)}`)
    if (ts.isStringLiteral(arg)) return {kind: 'literal', valueType: 'string', values: [arg.text], optional: false}
    if (ts.isNumericLiteral(arg)) return {kind: 'literal', valueType: 'number', values: [Number(arg.text)], optional: false}
    if (arg.kind === ts.SyntaxKind.TrueKeyword) return {kind: 'literal', valueType: 'boolean', values: [true], optional: false}
    if (arg.kind === ts.SyntaxKind.FalseKeyword) return {kind: 'literal', valueType: 'boolean', values: [false], optional: false}
    die(`Unsupported v.literal(...) argument: ${printNode(expr, sourceFile)}`)
  }

  if (isVCall(expr, 'array')) {
    const inner = expr.arguments[0]
    if (!inner) die(`v.array() missing argument: ${printNode(expr, sourceFile)}`)
    return {kind: 'array', of: kindFromValidator(inner, sourceFile), optional: false}
  }

  if (isVCall(expr, 'object')) {
    const obj = expr.arguments[0]
    if (!obj || !ts.isObjectLiteralExpression(obj)) die(`v.object(...) must be object literal: ${printNode(expr, sourceFile)}`)
    const fields = {}
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) die(`Unsupported object field: ${printNode(prop, sourceFile)}`)
      fields[prop.name.text] = kindFromValidator(prop.initializer, sourceFile)
    }
    return {kind: 'object', fields, optional: false}
  }

  if (isVCall(expr, 'union')) {
    const metas = expr.arguments.map((a) => kindFromValidator(a, sourceFile))
    // detect simple union-of-literals for select
    const literalMetas = metas.filter((m) => m.kind === 'literal' && m.optional === false)
    if (literalMetas.length === metas.length) {
      const valueType = literalMetas[0]?.valueType
      const values = literalMetas.flatMap((m) => m.values)
      return {kind: 'enum', valueType, values, optional: false}
    }
    return {kind: 'union', options: metas, optional: false}
  }

  if (isVCall(expr, 'record')) {
    return {kind: 'record', optional: false}
  }

  return {kind: 'unknown', source: printNode(expr, sourceFile), optional: false}
}

function findSchemaDefine(ast) {
  let found = null
  function visit(node) {
    if (isCall(node, 'defineSchema')) {
      found = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

function extractTables(sourceFile) {
  const schemaCall = findSchemaDefine(sourceFile)
  if (!schemaCall) die('Could not find defineSchema(...) call')
  const arg0 = schemaCall.arguments[0]
  if (!arg0 || !ts.isObjectLiteralExpression(arg0)) die('defineSchema(...) must be called with an object literal')

  /** @type {Array<{tableName: string, fields: Record<string, ts.Expression>}>} */
  const tables = []

  for (const prop of arg0.properties) {
    if (!ts.isPropertyAssignment(prop)) die(`Unsupported schema property: ${prop.kind}`)
    const name = prop.name
    if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) die(`Unsupported table name: ${name.getText(sourceFile)}`)
    const tableName = ts.isIdentifier(name) ? name.text : name.text

    // Expect: defineTable({...}).index(...)
    let value = prop.initializer
    // strip call chains like defineTable(...).index(...).index(...)
    while (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression)) {
      value = value.expression.expression
    }

    if (!ts.isCallExpression(value) || !(ts.isIdentifier(value.expression) && value.expression.text === 'defineTable')) {
      die(`Table ${tableName} must be defineTable(...): ${prop.initializer.getText(sourceFile)}`)
    }

    const tableArg = value.arguments[0]
    if (!tableArg) die(`defineTable() missing first argument for table ${tableName}`)

    let fieldsObj = null
    if (ts.isObjectLiteralExpression(tableArg)) {
      fieldsObj = tableArg
    } else if (isVCall(tableArg, 'object')) {
      const obj = tableArg.arguments[0]
      if (!obj || !ts.isObjectLiteralExpression(obj)) die(`defineTable(v.object(...)) must contain object literal for ${tableName}`)
      fieldsObj = obj
    } else {
      die(`Unsupported defineTable(...) argument for ${tableName}: ${tableArg.getText(sourceFile)}`)
    }

    /** @type {Record<string, ts.Expression>} */
    const fields = {}
    for (const fieldProp of fieldsObj.properties) {
      if (!ts.isPropertyAssignment(fieldProp) || !ts.isIdentifier(fieldProp.name)) {
        die(`Unsupported field in ${tableName}: ${fieldProp.getText(sourceFile)}`)
      }
      fields[fieldProp.name.text] = fieldProp.initializer
    }

    tables.push({tableName, fields})
  }

  return tables
}

function generateTableBaseInner({tableName, fields}, sourceFile) {
  const fieldEntries = Object.entries(fields)

  const createFields = fieldEntries.map(([k, vExpr]) => `    ${JSON.stringify(k)}: ${printNode(vExpr, sourceFile)},`).join('\n')

  const patchFields = fieldEntries
    .map(([k, vExpr]) => {
      const {inner} = unwrapOptional(vExpr, sourceFile)
      return `    ${JSON.stringify(k)}: v.optional(${printNode(inner, sourceFile)}),`
    })
    .join('\n')

  // Keep this bounded to avoid unbounded reads as tables grow.
  const LENGTH_MAX = 5000

  return `export const length = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query(${JSON.stringify(tableName)}).take(${LENGTH_MAX})
    return {count: rows.length, isTruncated: rows.length === ${LENGTH_MAX}}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  handler: async (ctx, args) => {
    return await ctx.db.query(${JSON.stringify(tableName)}).order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id(${JSON.stringify(tableName)})},
  handler: async (ctx, args) => {
    return await ctx.db.get(${JSON.stringify(tableName)}, args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
${createFields}
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert(${JSON.stringify(tableName)}, args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id(${JSON.stringify(tableName)}),
    patch: v.object({
${patchFields}
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(${JSON.stringify(tableName)}, args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id(${JSON.stringify(tableName)})},
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})`
}

const TABLE_FILE_HEADER = `import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

import {mutation, query} from '@convex/_generated/server'
`

function upsertTableBaseFile(tablePath, table, sourceFile) {
  const inner = generateTableBaseInner(table, sourceFile)
  const markedBlock = `${MARK_START}\n${inner}\n${MARK_END}`

  if (!fs.existsSync(tablePath)) {
    const content = `${TABLE_FILE_HEADER}\n\n${markedBlock}\n\n`
    fs.writeFileSync(tablePath, content, 'utf8')
    return
  }

  const text = readText(tablePath)
  const si = text.indexOf(MARK_START)
  const ei = text.indexOf(MARK_END)

  if (si === -1 || ei === -1 || ei < si) {
    die(`${tablePath} must contain:\n${MARK_START}\n...\n${MARK_END}\n` + `Add these lines (see docs/convex-db-division.md) or delete the file and re-run db:gen to scaffold.`)
  }

  const next = text.slice(0, si + MARK_START.length) + '\n' + inner + '\n' + text.slice(ei)
  fs.writeFileSync(tablePath, next, 'utf8')
}

/** `convex/tables/demo.ts` → `tables.demo` (for `api.tables.demo`). */
function toTableModuleAccessor(tableName) {
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(tableName)) {
    die(`Table name ${JSON.stringify(tableName)} must be a valid JS identifier for api.tables.<name> (or adjust gen-db-meta / registry).`)
  }
  return `tables.${tableName}`
}

function generateRegistry(tables) {
  const tableLiterals = tables.map((t) => JSON.stringify(t.tableName)).join(', ')
  const mappingEntries = tables
    .map((t) => {
      const tn = t.tableName
      const mod = toTableModuleAccessor(tn)
      return `  ${JSON.stringify(tn)}: {
    length: api.${mod}.length,
    list: api.${mod}.list,
    getById: api.${mod}.getById,
    create: api.${mod}.create,
    update: api.${mod}.update,
    remove: api.${mod}.remove,
  },`
    })
    .join('\n')

  // convex/tables/<name>.ts => api.tables.<name> (e.g. api.tables.demo)
  return `// This file is auto-generated by scripts/gen-db-meta.mjs. Do not edit manually.

import {api} from '@/lib/convex'
import type {TableNames} from '@convex/_generated/dataModel'

export const dbTables = [${tableLiterals}] as const
export type DbTable = (typeof dbTables)[number]

export const dbAdminApi = {
${mappingEntries}
} as const satisfies Record<
  DbTable,
  {
    length: unknown
    list: unknown
    getById: unknown
    create: unknown
    update: unknown
    remove: unknown
  }
>

export function isDbTable(slug: string): slug is DbTable {
  return (dbTables as readonly string[]).includes(slug)
}

export function assertDbTable(slug: string): DbTable {
  if (!isDbTable(slug)) throw new Error('Unknown table: ' + slug)
  return slug
}

// Type-level check that generated names are valid Convex table names.
// (Not used at runtime.)
export type _DbTableNamesCheck = DbTable extends TableNames ? true : never
`
}

function generateMeta(tables, sourceFile) {
  const tablesMeta = tables
    .map((t) => {
      const fieldMetaEntries = Object.entries(t.fields).map(([fieldName, vExpr]) => {
        const meta = kindFromValidator(vExpr, sourceFile)
        return `      ${JSON.stringify(fieldName)}: ${JSON.stringify(meta)},`
      })
      return `  ${JSON.stringify(t.tableName)}: {\n    fields: {\n${fieldMetaEntries.join('\n')}\n    },\n  },`
    })
    .join('\n')

  return `// This file is auto-generated by scripts/gen-db-meta.mjs. Do not edit manually.

export type FieldMeta =
  | {kind: 'string' | 'number' | 'boolean' | 'int64' | 'bytes' | 'null'; optional: boolean}
  | {kind: 'id'; table: string; optional: boolean}
  | {kind: 'enum'; valueType: 'string' | 'number' | 'boolean'; values: Array<string | number | boolean>; optional: boolean}
  | {kind: 'literal'; valueType: 'string' | 'number' | 'boolean'; values: Array<string | number | boolean>; optional: boolean}
  | {kind: 'array'; of: FieldMeta; optional: boolean}
  | {kind: 'object'; fields: Record<string, FieldMeta>; optional: boolean}
  | {kind: 'union'; options: FieldMeta[]; optional: boolean}
  | {kind: 'record'; optional: boolean}
  | {kind: 'unknown'; source: string; optional: boolean}

export const dbMeta = {
${tablesMeta}
} as const

export type DbMeta = typeof dbMeta
export type DbTableName = keyof DbMeta & string
export type DbTableMeta<T extends DbTableName> = DbMeta[T]
`
}

function main() {
  if (!fs.existsSync(schemaPath)) die(`Schema not found at ${schemaPath}`)
  const schemaText = readText(schemaPath)
  const sourceFile = ts.createSourceFile(schemaPath, schemaText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const tables = extractTables(sourceFile)
  if (tables.length === 0) die('No tables found in schema')

  ensureDir(path.dirname(outMetaPath))
  ensureDir(path.dirname(outRegistryPath))
  ensureDir(tablesDir)

  for (const table of tables) {
    const tablePath = path.join(tablesDir, `${table.tableName}.ts`)
    upsertTableBaseFile(tablePath, table, sourceFile)
  }

  // src/lib/db/meta.generated.ts
  fs.writeFileSync(outMetaPath, generateMeta(tables, sourceFile), 'utf8')

  // src/lib/db/registry.generated.ts
  fs.writeFileSync(outRegistryPath, generateRegistry(tables), 'utf8')

  console.log(`[gen-db-meta] Generated meta + ${tables.length} table file(s) (base blocks).`)
}

main()
