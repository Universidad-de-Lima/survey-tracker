import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  COLUMNA_ID,
  crearServidor,
  decodificarCsv,
  detectarDelimitador,
  parsearCsv,
  resumirCsv,
} from '../../servidor-local.js';

// Estas pruebas no llaman a internet ni a modelos: suben bytes a un servidor
// temporal y leen el resumen que devuelve.

let sitio;
let entradas;
let servidor;
let base;

// Un CSV válido de Zoho en utf-8-sig (BOM) con comas y una fila repetida.
const CSV_UTF8 = [
  'ID de respuesta,Estado de respuesta,Nivel de satisfacción',
  'r1,COMPLETED,Alto',
  'r2,COMPLETED,Medio',
  'r3,PARTIAL,Bajo',
  'r2,COMPLETED,Alto',
].join('\r\n');

function bufferUtf8Sig(texto) {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(texto, 'utf8')]);
}

// Un CSV en cp1252 (Windows) con punto y coma y una tilde.
const CSV_CP1252 = [
  'ID de respuesta;Estado de respuesta;Observación',
  'a1;COMPLETED;Buena atención',
  'a2;PARTIAL;Regular',
].join('\r\n');

beforeAll(async () => {
  sitio = await mkdtemp(path.join(tmpdir(), 'portal-csv-'));
  entradas = path.join(sitio, 'entradas');
  await mkdir(entradas);

  // Límite pequeño a propósito: así la prueba de "demasiado grande" no sube
  // megabytes (los CSV válidos de esta prueba pesan unos cientos de bytes).
  servidor = crearServidor({ sitio, entradas, limiteCsv: 500 });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((ok) => servidor.close(ok));
  await rm(sitio, { recursive: true, force: true });
});

function subir(cuerpo, opciones = {}) {
  const nombre = opciones.nombre ? '?nombre=' + encodeURIComponent(opciones.nombre) : '';
  return fetch(base + '/api/subir-csv' + nombre, {
    method: 'POST',
    headers: { 'Content-Type': opciones.tipo || 'text/csv' },
    body: cuerpo,
  });
}

describe('subir CSV: recepción y resumen', () => {
  it('guarda un CSV utf-8-sig con comas y resume filas, únicos y estados', async () => {
    const r = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: 'encuesta-estudiantil' });

    expect(r.status).toBe(200);
    const datos = await r.json();
    expect(datos.ok).toBe(true);
    expect(datos.codificacion).toBe('utf-8-sig');
    expect(datos.delimitador).toBe(',');
    expect(datos.resumen).toEqual({
      filas: 4,
      identificadores_unicos: 3,
      completas: 3,
      parciales: 1,
      columnas_faltantes: [],
    });
  });

  it('detecta cp1252 con punto y coma', async () => {
    const r = await subir(Buffer.from(CSV_CP1252, 'latin1'), { nombre: 'no-docente' });

    expect(r.status).toBe(200);
    const datos = await r.json();
    expect(datos.codificacion).toBe('cp1252');
    expect(datos.delimitador).toBe(';');
    expect(datos.resumen.filas).toBe(2);
    expect(datos.resumen.identificadores_unicos).toBe(2);
    expect(datos.resumen.completas).toBe(1);
    expect(datos.resumen.parciales).toBe(1);
  });

  it('deja el archivo guardado en la carpeta de entradas con un nombre único', async () => {
    const antes = await readdir(entradas);
    const r = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: 'docente' });

    expect(r.status).toBe(200);
    const { archivo } = await r.json();
    const despues = await readdir(entradas);

    expect(archivo).toMatch(/^\d{8}-\d{6}-docente(-\d+)?\.csv$/);
    expect(despues.length).toBe(antes.length + 1);
    expect(despues).toContain(archivo);
  });

  it('no sobrescribe: dos subidas seguidas dejan dos archivos distintos', async () => {
    const r1 = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: 'repetida' });
    const r2 = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: 'repetida' });

    const a = (await r1.json()).archivo;
    const b = (await r2.json()).archivo;

    expect(a).not.toBe(b);
    const archivos = await readdir(entradas);
    expect(archivos).toContain(a);
    expect(archivos).toContain(b);
  });
});

describe('subir CSV: rechazos', () => {
  it('rechaza un archivo que no tiene la columna "ID de respuesta"', async () => {
    const sinId = ['Nombre,Estado de respuesta', 'x,COMPLETED'].join('\r\n');
    const r = await subir(Buffer.from(sinId, 'utf8'));

    expect(r.status).toBe(400);
    const datos = await r.json();
    expect(datos.error).toContain(COLUMNA_ID);
    expect(datos.columnas_faltantes).toContain(COLUMNA_ID);
  });

  it('rechaza una subida que pasa el límite de tamaño', async () => {
    const enorme = Buffer.alloc(2000, 0x61); // 2000 bytes > límite de 500
    const r = await subir(enorme);

    expect(r.status).toBe(413);
    expect((await r.json()).error).toBeTruthy();
  });

  it('solo atiende POST', async () => {
    const r = await fetch(base + '/api/subir-csv');

    expect(r.status).toBe(405);
  });
});

describe('subir CSV: utilidades de parseo', () => {
  it('decodifica el BOM y detecta el delimitador', () => {
    const { codificacion, texto } = decodificarCsv(bufferUtf8Sig(CSV_UTF8));
    expect(codificacion).toBe('utf-8-sig');
    expect(texto.startsWith(COLUMNA_ID)).toBe(true);
    expect(detectarDelimitador(texto)).toBe(',');
    expect(detectarDelimitador(CSV_CP1252)).toBe(';');
  });

  it('parsea comillas, comas y saltos dentro de un campo', () => {
    const filas = parsearCsv('ID de respuesta,Estado de respuesta,Nota\n"a,1",COMPLETED,"dice ""hola"""', ',');
    expect(filas[1]).toEqual(['a,1', 'COMPLETED', 'dice "hola"']);
  });

  it('resume columnas faltantes sin romper cuando solo falta el estado', () => {
    const resumen = resumirCsv(parsearCsv('ID de respuesta,Nivel\nr1,Alto', ','));
    expect(resumen.columnas_faltantes).toEqual(['Estado de respuesta']);
    expect(resumen.identificadores_unicos).toBe(1);
  });
});
