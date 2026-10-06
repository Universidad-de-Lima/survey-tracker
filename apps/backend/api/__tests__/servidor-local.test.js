import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearServidor, resolverSitio, tipoMime } from '../../servidor-local.js';

// Estas pruebas no llaman a internet: solo leen archivos temporales creados aquí.

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
