/**
 * Lightweight "private pages" guard (edge middleware).
 *
 * How it works:
 * - For any request whose pathname matches `config.matcher`, we require a valid cookie.
 * - First-time access: open the protected page with `?key=ACCESS_KEY`.
 *   If it matches, we mint a signed JWT (HS256) with 1-year expiry, store it in a httpOnly cookie,
 *   and redirect to the same URL without the `key` param (to reduce leakage via logs/history/referrer).
 * - Subsequent access: we verify the JWT from the cookie; if invalid/missing → redirect to `/`.
 *
 * Security notes:
 * - Cookie is httpOnly + sameSite; `secure` is enabled only for https (so localhost dev still works).
 * - Use `ACCESS_KEY` to sign/verify tokens (separate from link secret).
 * - Future hardening (optional): set & enforce JWT `iss` / `aud` in jose.
 */

import type {NextRequest} from 'next/server'

import {NextResponse} from 'next/server'
import {SignJWT, jwtVerify} from 'jose'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
export const ACCESS_COOKIE_NAME = 'access-token'

type MiddlewareMatcher = string

function matcherApplies(pathname: string, matcher: MiddlewareMatcher) {
  // Examples:
  // - '/demo-convex' matches only exact path
  // - '/db/:slug' matches anything starting with '/db/' (and not '/db' itself)
  if (matcher.includes('/:')) {
    const base = matcher.split('/:')[0] ?? matcher
    return pathname === base ? false : pathname.startsWith(`${base}/`)
  }
  return pathname === matcher
}

function isProtectedPath(pathname: string) {
  // Single source of truth: reuse the static matcher list from config.
  return config.matcher.some((m) => matcherApplies(pathname, m))
}

function setPrivacyHeaders(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  return res
}

async function mintAccessToken(signingKey: string) {
  const key = new TextEncoder().encode(signingKey)
  return await new SignJWT({v: 1})
    .setProtectedHeader({alg: 'HS256', typ: 'JWT'})
    .setIssuedAt()
    .setExpirationTime(`${ONE_YEAR_SECONDS}s`)
    // Future hardening (optional): bind tokens to a specific issuer/audience
    // to avoid accidental acceptance across different apps/environments.
    // .setIssuer(ACCESS_TOKEN_ISSUER)
    // .setAudience(ACCESS_TOKEN_AUDIENCE)
    .sign(key)
}

async function verifyAccessToken(signingKey: string, token: string) {
  const key = new TextEncoder().encode(signingKey)
  try {
    const {payload} = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      // If enabling issuer/audience above, also enforce them here:
      // issuer: ACCESS_TOKEN_ISSUER,
      // audience: ACCESS_TOKEN_AUDIENCE,
    })
    return payload?.v === 1
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (!isProtectedPath(pathname)) return NextResponse.next()

  const isHttps = request.nextUrl.protocol === 'https:'

  const secret = process.env.ACCESS_KEY
  if (!secret) {
    // Fail closed: if secret isn't configured, don't accidentally expose the page.
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Separate key used ONLY for signing/verifying the cookie token.
  // This allows rotating the link secret without invalidating existing cookies,
  // and provides a "panic button" (rotate signing key to revoke all cookies).
  const signingKey = process.env.ACCESS_TOKEN_SIGNING_KEY ?? secret

  // If key is present in URL, issue a signed token cookie and redirect to a clean URL.
  const keyParam = request.nextUrl.searchParams.get('key')
  if (keyParam === secret) {
    const token = await mintAccessToken(signingKey)
    const cleanUrl = new URL(request.nextUrl)
    cleanUrl.searchParams.delete('key')
    cleanUrl.pathname = pathname

    const res = NextResponse.redirect(cleanUrl)
    res.cookies.set(ACCESS_COOKIE_NAME, token, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      priority: 'high',
    })
    return setPrivacyHeaders(res)
  }

  // Otherwise require a valid signed token.
  const accessCookie = request.cookies.get(ACCESS_COOKIE_NAME)
  const ok = accessCookie?.value ? await verifyAccessToken(signingKey, accessCookie.value) : false
  if (!ok) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return setPrivacyHeaders(NextResponse.next())
}

export const config = {
  // Must be statically analyzable by Next.js at build time.
  // Keep this list minimal: only paths that may require auth should be matched.
  // NOTE: matcher must be a static literal (Next.js requirement).
  matcher: ['/db', '/db/:slug'],
}
