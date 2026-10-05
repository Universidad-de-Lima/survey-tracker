import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearServidor, resolverSitio, tipoMime } from '../../servidor-local.js';

// Estas pruebas NO llaman a ningún modelo real ni a internet: el único POST que
// llega al intérprete usa un `fetch` simulado. Las demás solo leen archivos
// temporales creados aquí.

let sitio;
let servidor;
let base;

beforeAll(async () => {
  sitio = await mkdtemp(path.join(tmpdir(), 'portal-local-'));
  await writeFile(path.join(sitio, 'index.html'), '<!doctype html><h1>Portal de encuestas</h1>');
  await writeFile(path.join(sitio, 'datos.json'), JSON.stringify({ ok: true }));
  await mkdir(path.join(sitio, 'sub'));
  await writeFile(path.join(sitio, 'sub', 'x.txt'), 'hola');

  servidor = crearServidor({ sitio });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((ok) => servidor.close(ok));
  await rm(sitio, { recursive: true, force: true });
});

describe('servidor local: archivos estáticos', () => {
  it('sirve "/" con index.html y su tipo MIME', async () => {
    const r = await fetch(base + '/');

    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(await r.text()).toContain('Portal de encuestas');
  });

  it('sirve un .json con el tipo application/json', async () => {
    const r = await fetch(base + '/datos.json');

    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(await r.json()).toEqual({ ok: true });
  });

  it('responde 404 claro en una ruta inexistente', async () => {
    const r = await fetch(base + '/no-existe.html');

    expect(r.status).toBe(404);
    expect((await r.json()).error).toBeTruthy();
  });

  it('no lista directorios (una carpeta sin index.html responde 404)', async () => {
    const r = await fetch(base + '/sub/');

    expect(r.status).toBe(404);
    expect((await r.json()).error).toBeTruthy();
  });

  it('no deja salir de la carpeta servida con ".."', async () => {
    const r = await fetch(base + '/../../servidor-local.js');

    expect(r.status).toBe(404);
  });
});

describe('servidor local: /api/interpretar', () => {
  const original = { key: process.env.GOOGLE_API_KEY, fetch: globalThis.fetch };

  beforeEach(() => {
    globalThis.fetch = original.fetch;
    if (original.key === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = original.key;
  });

  it('405 cuando el método no es POST', async () => {
    const r = await fetch(base + '/api/interpretar', { method: 'GET' });

    expect(r.status).toBe(405);
    expect((await r.json()).error).toBeTruthy();
  });

  it('400 cuando el cuerpo no es JSON válido', async () => {
    const r = await fetch(base + '/api/interpretar', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'esto no es json',
    });

    expect(r.status).toBe(400);
    expect((await r.json()).error).toBeTruthy();
  });

  it('responde un error claro (no se cuelga) cuando falta GOOGLE_API_KEY', async () => {
    delete process.env.GOOGLE_API_KEY;
    const r = await fetch(base + '/api/interpretar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: '¿Cuántos respondieron?' }),
    });

    expect(r.status).toBe(500);
    expect((await r.json()).error).toContain('GOOGLE_API_KEY');
  });

  it('reutiliza el handler de Vercel: con una respuesta simulada devuelve la consulta', async () => {
    process.env.GOOGLE_API_KEY = 'llave-de-prueba';
    // El servidor llama internamente a `fetch`; aquí se simula ESA llamada para
    // no tocar la red ni ningún modelo. La petición al servidor de prueba debe
    // usar el fetch real (realFetch), o se la comería el propio simulacro.
    const realFetch = original.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"se_puede":true,"operacion":"nps","periodo":"2026-1"}' }] } }],
      }),
    });

    const r = await realFetch(base + '/api/interpretar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: '¿Cuál es el NPS?' }),
    });
    const datos = await r.json();

    expect(r.status).toBe(200);
    expect(datos.consulta.operacion).toBe('nps');
    globalThis.fetch = original.fetch;
  });
});

describe('servidor local: configuración', () => {
  it('resuelve la carpeta servida o avisa con un error claro', () => {
    expect(resolverSitio(sitio)).toBe(path.resolve(sitio));
    expect(() => resolverSitio('C:/ruta/que/no/existe')).toThrow(/SITIO_DIR/);
  });

  it('asigna el tipo MIME que corresponde a cada extensión', () => {
    expect(tipoMime('index.html')).toContain('text/html');
    expect(tipoMime('estilo.css')).toContain('text/css');
    expect(tipoMime('app.js')).toContain('javascript');
    expect(tipoMime('logo.svg')).toBe('image/svg+xml');
    expect(tipoMime('fuente.woff2')).toBe('font/woff2');
    expect(tipoMime('desconocido.bin')).toBe('application/octet-stream');
  });
});
