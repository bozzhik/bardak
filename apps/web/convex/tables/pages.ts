import {normalizeTagToken} from '@repo/shared'
import {mutation, query} from '@convex/_generated/server'
import type {Doc, Id} from '@convex/_generated/dataModel'
import type {MutationCtx, QueryCtx} from '@convex/_generated/server'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

const nullableString = v.union(v.string(), v.null())
const nullableNumber = v.union(v.number(), v.null())
const kind = v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported'))

const context = v.object({
  forwardOrigin: nullableString,
  forwardDate: nullableNumber,
  replyToMessageId: nullableNumber,
})

const file = v.object({
  fileId: nullableString,
  fileUniqueId: nullableString,
  fileName: nullableString,
  mimeType: nullableString,
  fileSize: nullableNumber,
  duration: nullableNumber,
  width: nullableNumber,
  height: nullableNumber,
  emoji: nullableString,
  setName: nullableString,
  isAnimated: v.union(v.boolean(), v.null()),
  isVideo: v.union(v.boolean(), v.null()),
})

const telegram = v.object({
  type: v.string(),
  context,
  file,
})

const publicEntry = v.object({
  id: v.id('entries'),
  kind,
  text: nullableString,
  description: nullableString,
  url: nullableString,
  createdAt: v.number(),
  telegram,
})

const publicPageResult = v.union(
  v.object({status: v.literal('missing')}),
  v.object({
    status: v.literal('found'),
    page: v.object({
      id: v.id('pages'),
      title: v.string(),
      shareSlug: v.string(),
      createdAt: v.number(),
    }),
    owner: v.object({
      username: nullableString,
    }),
    tag: v.object({
      name: v.string(),
      slug: v.string(),
    }),
    entries: v.array(publicEntry),
    isTruncated: v.boolean(),
  }),
)

const SHARE_SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
const SHARE_SLUG_LENGTH = 12
const PUBLIC_ENTRY_LIMIT = 100
const PAGE_ENTRY_SCAN_LIMIT = 1000

function createShareSlug(): string {
  let slug = ''
  for (let index = 0; index < SHARE_SLUG_LENGTH; index += 1) {
    slug += SHARE_SLUG_ALPHABET[Math.floor(Math.random() * SHARE_SLUG_ALPHABET.length)]
  }
  return slug
}

async function createUniqueShareSlug(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shareSlug = createShareSlug()
    const existing = await ctx.db
      .query('pages')
      .withIndex('by_shareSlug', (q) => q.eq('shareSlug', shareSlug))
      .unique()
    if (existing === null) return shareSlug
  }
  throw new Error('Unable to create unique share slug')
}

async function getActiveEntriesForTag(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, tagId: Id<'tags'>, limit: number): Promise<{entries: Array<Doc<'entries'>>; isTruncated: boolean}> {
  const links = await ctx.db
    .query('entryTags')
    .withIndex('by_userId_and_tagId', (q) => q.eq('userId', userId).eq('tagId', tagId))
    .take(PAGE_ENTRY_SCAN_LIMIT)

  const rows = await Promise.all(links.map((link) => ctx.db.get(link.entryId)))
  const entries = rows.filter((entry): entry is Doc<'entries'> => entry !== null && entry.userId === userId && entry.status !== 'archived').sort((left, right) => right.createdAt - left.createdAt || right._creationTime - left._creationTime)

  return {
    entries: entries.slice(0, limit),
    isTruncated: entries.length > limit,
  }
}

export const createFromTag = mutation({
  args: {
    userId: v.id('users'),
    tag: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.union(v.literal('created'), v.literal('existing')),
      pageId: v.id('pages'),
      shareSlug: v.string(),
      title: v.string(),
      activeEntryCount: v.number(),
    }),
    v.object({
      status: v.union(v.literal('invalid_tag'), v.literal('missing_tag'), v.literal('empty_tag')),
    }),
  ),
  handler: async (ctx, args) => {
    const normalizedTag = normalizeTagToken(args.tag)
    if (normalizedTag === null) return {status: 'invalid_tag' as const}

    const tag = await ctx.db
      .query('tags')
      .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', normalizedTag.slug))
      .unique()
    if (tag === null) return {status: 'missing_tag' as const}

    const activeEntries = await getActiveEntriesForTag(ctx, args.userId, tag._id, PAGE_ENTRY_SCAN_LIMIT)
    if (activeEntries.entries.length === 0) return {status: 'empty_tag' as const}

    const existing = await ctx.db
      .query('pages')
      .withIndex('by_userId_and_tagId', (q) => q.eq('userId', args.userId).eq('tagId', tag._id))
      .unique()
    if (existing !== null) {
      if (existing.status === 'archived') {
        await ctx.db.patch(existing._id, {
          status: 'published',
          archivedAt: null,
          updatedAt: Date.now(),
        })
      }

      return {
        status: 'existing' as const,
        pageId: existing._id,
        shareSlug: existing.shareSlug,
        title: existing.title,
        activeEntryCount: activeEntries.entries.length,
      }
    }

    const now = Date.now()
    const pageId = await ctx.db.insert('pages', {
      userId: args.userId,
      source: 'tag',
      tagId: tag._id,
      title: `#${tag.name}`,
      status: 'published',
      shareSlug: await createUniqueShareSlug(ctx),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })
    const page = await ctx.db.get(pageId)
    if (page === null) throw new Error('Created page is missing')

    return {
      status: 'created' as const,
      pageId,
      shareSlug: page.shareSlug,
      title: page.title,
      activeEntryCount: activeEntries.entries.length,
    }
  },
})

export const getPublicBySlug = query({
  args: {
    shareSlug: v.string(),
  },
  returns: publicPageResult,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('pages')
      .withIndex('by_shareSlug', (q) => q.eq('shareSlug', args.shareSlug))
      .unique()
    if (page === null || page.status !== 'published') return {status: 'missing' as const}

    const [owner, tag, activeEntries] = await Promise.all([ctx.db.get(page.userId), ctx.db.get(page.tagId), getActiveEntriesForTag(ctx, page.userId, page.tagId, PUBLIC_ENTRY_LIMIT)])
    if (owner === null || tag === null) return {status: 'missing' as const}

    return {
      status: 'found' as const,
      page: {
        id: page._id,
        title: page.title,
        shareSlug: page.shareSlug,
        createdAt: page.createdAt,
      },
      owner: {
        username: owner.username,
      },
      tag: {
        name: tag.name,
        slug: tag.slug,
      },
      entries: activeEntries.entries.map((entry) => ({
        id: entry._id,
        kind: entry.kind,
        text: entry.text,
        description: entry.description,
        url: entry.url,
        createdAt: entry.createdAt,
        telegram: entry.telegram,
      })),
      isTruncated: activeEntries.isTruncated,
    }
  },
})

// ! DO NOT UPDATE MANNUALLY THIS PART – it's generated by the script `scripts/gen-db-meta.mjs`
// db-gen:base:start
export const length = query({
  args: {},
  returns: v.object({
    count: v.number(),
    isTruncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query('pages').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('pages'),
        _creationTime: v.number(),
        userId: v.id('users'),
        source: v.literal('tag'),
        tagId: v.id('tags'),
        title: v.string(),
        status: v.union(v.literal('published'), v.literal('archived')),
        shareSlug: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        archivedAt: v.union(v.number(), v.null()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('pages').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('pages')},
  returns: v.union(
    v.object({
      _id: v.id('pages'),
      _creationTime: v.number(),
      userId: v.id('users'),
      source: v.literal('tag'),
      tagId: v.id('tags'),
      title: v.string(),
      status: v.union(v.literal('published'), v.literal('archived')),
      shareSlug: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('pages', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.id('users'),
      source: v.literal('tag'),
      tagId: v.id('tags'),
      title: v.string(),
      status: v.union(v.literal('published'), v.literal('archived')),
      shareSlug: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.union(v.number(), v.null()),
    }),
  },
  returns: v.id('pages'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('pages', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('pages'),
    patch: v.object({
      userId: v.optional(v.id('users')),
      source: v.optional(v.literal('tag')),
      tagId: v.optional(v.id('tags')),
      title: v.optional(v.string()),
      status: v.optional(v.union(v.literal('published'), v.literal('archived'))),
      shareSlug: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      archivedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('pages', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('pages')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
