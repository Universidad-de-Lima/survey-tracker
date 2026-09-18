import { describe, expect, it } from 'vitest';

import {
  DEDUPE_COOKIE_MAX_AGE_SECONDS,
  buildCookie,
  dedupeCookieName,
  hasCookie,
} from '../cookies.js';

describe('DEDUPE_COOKIE_MAX_AGE_SECONDS', () => {
  it('lasts 2 hours: enough for any classroom, and the reset does the real work', () => {
    expect(DEDUPE_COOKIE_MAX_AGE_SECONDS).toBe(2 * 60 * 60);
  });
});

describe('dedupeCookieName', () => {
  it('includes the session generation, so a reset invalidates the cookies already out there', () => {
    expect(dedupeCookieName('escaneo', 'default', 0)).toBe('escaneo_default_g0');
    expect(dedupeCookieName('terminado', 'salon-302', 7)).toBe('terminado_salon-302_g7');
  });
});

describe('hasCookie', () => {
  it('finds the cookie among others', () => {
    expect(hasCookie({ headers: { cookie: 'a=1; escaneo_default=1' } }, 'escaneo_default')).toBe(
      true,
    );
  });

  it('is false when the cookie is missing', () => {
    expect(hasCookie({ headers: { cookie: 'a=1; b=2' } }, 'escaneo_default')).toBe(false);
  });

  it('is false without a cookie header', () => {
    expect(hasCookie({}, 'escaneo_default')).toBe(false);
    expect(hasCookie({ headers: {} }, 'escaneo_default')).toBe(false);
  });

  it('does not match a cookie that merely starts with the same name', () => {
    expect(hasCookie({ headers: { cookie: 'escaneo_default_otro=1' } }, 'escaneo_default')).toBe(
      false,
    );
  });
});

describe('buildCookie', () => {
  it('is HttpOnly, SameSite=Lax and Secure', () => {
    const cookie = buildCookie('escaneo_default');

    expect(cookie).toContain('escaneo_default=1');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${DEDUPE_COOKIE_MAX_AGE_SECONDS}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('accepts a custom lifetime', () => {
    expect(buildCookie('x', 60)).toContain('Max-Age=60');
  });
});
