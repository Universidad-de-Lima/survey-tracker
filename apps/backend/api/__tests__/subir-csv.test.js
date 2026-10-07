import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  COLUMNA_ID,
  ENCUESTAS_CONOCIDAS,
  crearServidor,
  decodificarCsv,
  detectarDelimitador,
  encuestaConocida,
  normalizarNombre,
  parsearCsv,
  resumirCsv,
} from '../../servidor-local.js';

// Estas pruebas no llaman a internet ni ejecutan el proceso real: suben bytes a
// un servidor temporal y usan un doble de `ejecutarProceso`.

const ESTUDIANTIL = 'ENCUESTA DE SATISFACCIÓN ESTUDIANTIL - PREGRADO - 2026-2.csv';
const NO_DOCENTE = 'ENCUESTA DE SATISFACCIÓN NO DOCENTE - 2026.csv';

let sitio;
let entradas;
let dataDir;
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

const procesoOk = () => Promise.resolve({ ok: true, codigo: 0, salida: 'publicado' });
const procesoFalla = () => Promise.resolve({ ok: false, codigo: 1, salida: 'boom\nKeyError: X' });

beforeAll(async () => {
  sitio = await mkdtemp(path.join(tmpdir(), 'portal-csv-'));
  entradas = path.join(sitio, 'entradas');
  dataDir = path.join(sitio, 'data');
  await mkdir(entradas);
  await mkdir(dataDir);

  // Un dashboard_data.json ya publicado, para probar la lectura de números.
  const salida = path.join(sitio, 'students', 'undergraduate', '2026-2', 'json');
  await mkdir(salida, { recursive: true });
  await writeFile(
    path.join(salida, 'dashboard_data.json'),
    JSON.stringify({ resumen: { periodo: '2026-2', encuestas: 1144, nps: { score: 70.5 }, csat: { score: 92.1 } } }),
  );

  // Límite pequeño a propósito: así la prueba de "demasiado grande" no sube
  // megabytes (los CSV válidos de esta prueba pesan unos cientos de bytes).
  servidor = crearServidor({ sitio, entradas, data: dataDir, limiteCsv: 500, ejecutarProceso: procesoOk });
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

describe('subir CSV: nombre de encuesta y actualización', () => {
  it('con un nombre conocido copia a data/ y devuelve los números nuevos', async () => {
    const r = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: ESTUDIANTIL });

    expect(r.status).toBe(200);
    const datos = await r.json();
    expect(datos.ok).toBe(true);
    expect(datos.encuesta).toBe(ESTUDIANTIL);
    expect(datos.codificacion).toBe('utf-8-sig');
    expect(datos.delimitador).toBe(',');
    expect(datos.resumen).toEqual({
      filas: 4,
      identificadores_unicos: 3,
      completas: 3,
      parciales: 1,
      columnas_faltantes: [],
    });
    expect(datos.numeros).toEqual({ periodo: '2026-2', encuestados: 1144, nps: 70.5, csat: 92.1 });

    // El CSV quedó en data/ con el nombre canónico que el proceso espera.
    const enData = await readFile(path.join(dataDir, ESTUDIANTIL), 'utf8');
    expect(enData).toContain('r1,COMPLETED,Alto');
  });

  it('detecta cp1252 con punto y coma (nombre NO DOCENTE)', async () => {
    const r = await subir(Buffer.from(CSV_CP1252, 'latin1'), { nombre: NO_DOCENTE });

    expect(r.status).toBe(200);
    const datos = await r.json();
    expect(datos.encuesta).toBe(NO_DOCENTE);
    expect(datos.codificacion).toBe('cp1252');
    expect(datos.delimitador).toBe(';');
    expect(datos.resumen.filas).toBe(2);
    expect(datos.resumen.identificadores_unicos).toBe(2);
    expect(datos.resumen.completas).toBe(1);
    expect(datos.resumen.parciales).toBe(1);
  });

  it('deja el archivo guardado en la carpeta de entradas con un nombre único', async () => {
    const antes = await readdir(entradas);
    const r = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: ESTUDIANTIL });

    expect(r.status).toBe(200);
    const { archivo } = await r.json();
    const despues = await readdir(entradas);

    expect(archivo).toMatch(/^\d{8}-\d{6}-ENCUESTA-DE-SATISFACCI.*\.csv$/);
    expect(despues.length).toBe(antes.length + 1);
    expect(despues).toContain(archivo);
  });

  it('no sobrescribe: dos subidas seguidas dejan dos archivos distintos', async () => {
    const r1 = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: ESTUDIANTIL });
    const r2 = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: ESTUDIANTIL });

    const a = (await r1.json()).archivo;
    const b = (await r2.json()).archivo;

    expect(a).not.toBe(b);
    const archivos = await readdir(entradas);
    expect(archivos).toContain(a);
    expect(archivos).toContain(b);
  });

  it('si el proceso falla, responde 500 con su salida', async () => {
    const srv = crearServidor({ sitio, entradas, data: dataDir, ejecutarProceso: procesoFalla });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const b = `http://127.0.0.1:${srv.address().port}`;

    const r = await fetch(b + '/api/subir-csv?nombre=' + encodeURIComponent(ESTUDIANTIL), {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: bufferUtf8Sig(CSV_UTF8),
    });

    expect(r.status).toBe(500);
    const datos = await r.json();
    expect(datos.ok).toBe(false);
    expect(datos.proceso.salida).toContain('KeyError');
    expect(datos.numeros).toBeNull();
    await new Promise((ok) => srv.close(ok));
  });

  it('no solapa dos subidas: mientras procesa, la segunda recibe 409', async () => {
    let empezo;
    const empezoP = new Promise((ok) => { empezo = ok; });
    let terminar;
    const lento = () => { empezo(); return new Promise((ok) => { terminar = ok; }); };

    const srv = crearServidor({ sitio, entradas, data: dataDir, limiteCsv: 500000, ejecutarProceso: lento });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const b = `http://127.0.0.1:${srv.address().port}`;
    const sub = () => fetch(b + '/api/subir-csv?nombre=' + encodeURIComponent(ESTUDIANTIL), {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: bufferUtf8Sig(CSV_UTF8),
    });

    const primera = sub();
    await empezoP;                       // el proceso ya arrancó (está en curso)
    const segunda = await sub();         // llega con la primera sin terminar

    expect(segunda.status).toBe(409);
    expect((await segunda.json()).ok).toBe(false);

    terminar({ ok: true, codigo: 0, salida: 'ok' });
    expect((await primera).status).toBe(200);
    await new Promise((ok) => srv.close(ok));
  });
});

describe('subir CSV: rechazos', () => {
  it('rechaza un nombre que no es de ninguna encuesta conocida y lista los aceptados', async () => {
    const antes = await readdir(dataDir);
    const r = await subir(bufferUtf8Sig(CSV_UTF8), { nombre: 'cualquier-cosa.csv' });

    expect(r.status).toBe(400);
    const datos = await r.json();
    expect(datos.ok).toBe(false);
    expect(datos.nombres_aceptados).toContain(ESTUDIANTIL);
    expect(datos.nombres_aceptados.length).toBe(ENCUESTAS_CONOCIDAS.length);
    // No procesa nada: data/ queda igual.
    expect(await readdir(dataDir)).toEqual(antes);
  });

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

describe('subir CSV: encuestas conocidas y parseo', () => {
  it('reconoce los nombres aceptados ignorando tildes, espacios y mayúsculas', () => {
    expect(encuestaConocida(ESTUDIANTIL)).toBeTruthy();
    expect(encuestaConocida('encuesta de satisfaccion no docente - 2026')).toBeTruthy();
    expect(encuestaConocida('  ENCUESTA DE SATISFACCIÓN NO DOCENTE - 2026.CSV')).toBeTruthy();
    expect(encuestaConocida('otra encuesta')).toBeNull();
    expect(encuestaConocida('')).toBeNull();
    expect(normalizarNombre('Encuesta  de  Prueba.CSV')).toBe('ENCUESTA DE PRUEBA');
  });

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
