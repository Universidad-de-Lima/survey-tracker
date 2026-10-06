// ============================================================
// Servidor local del portal de encuestas.
// ------------------------------------------------------------
// Reemplaza a Vercel para correr todo en la PC del usuario, sin dependencias:
// usa SOLO los módulos estándar de Node (http, fs, path, url, os).
//
// Qué hace:
//   Sirve por HTTP la carpeta de archivos estáticos del portal (SITIO_DIR).
//   Sirve "/" como index.html, con el tipo MIME correcto, 404 claro si el
//   archivo no existe y SIN listar directorios.
//   Atiende POST /api/subir-csv: recibe un CSV de Zoho (el archivo en crudo, no
//   multipart), lo guarda en la carpeta de entradas con un nombre único y
//   responde un resumen (filas, identificadores únicos, COMPLETED y PARTIAL).
//   NO ejecuta el ETL: solo recibe, guarda y resume.
//
// Cómo arranca el usuario (ver docs/servidor-local.md):
//   node --env-file="C:\ruta\portal.env" apps/backend/servidor-local.js
// Ese archivo .env vive FUERA de todo repositorio y contiene:
//   SITIO_DIR=Q:\ANALISTA DE DATOS\1. GitHub\survey-test\zoho-survey
//   PUERTO=8000
//   ENTRADAS_DIR=...\6.10 HTML\entradas   (opcional; por defecto, hermana de SITIO_DIR)
//   SUBIR_CSV_MAX_BYTES=10485760          (opcional; tope de la subida)
//
// Compatibilidad: Node 26 (y cualquier Node >= 18 con fetch global).
// ============================================================

import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- tipos MIME que sirve el portal ----------
export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** El tipo MIME de una ruta, o application/octet-stream si no es de los conocidos. */
export function tipoMime(ruta) {
  return MIME[path.extname(String(ruta)).toLowerCase()] || 'application/octet-stream';
}

// ---------- carpeta servida ----------
// Por defecto, la carpeta del portal de survey-test (los dos repositorios son
// hermanos). SITIO_DIR, si está definida, manda siempre.
const SITIO_TRACKER = path.resolve(__dirname, '..', '..');                 // .../survey-tracker
const SITIO_POR_DEFECTO = [
  'Q:\\ANALISTA DE DATOS\\1. GitHub\\survey-test\\zoho-survey',
  path.resolve(SITIO_TRACKER, '..', 'survey-test', 'zoho-survey'),
];

/**
 * Devuelve la carpeta a servir. Usa `dir` (o SITIO_DIR) si se indica; si no,
 * prueba las rutas conocidas del portal. Si ninguna existe, lanza un error claro.
 */
export function resolverSitio(dir = process.env.SITIO_DIR) {
  const candidatas = dir ? [dir] : SITIO_POR_DEFECTO;
  for (const candidata of candidatas) {
    try {
      if (existsSync(candidata) && statSync(candidata).isDirectory()) {
        return path.resolve(candidata);
      }
    } catch {
      // se prueba la siguiente
    }
  }
  throw new Error(
    dir
      ? `SITIO_DIR no es una carpeta válida: ${dir}`
      : 'No se encontró la carpeta del portal. Define SITIO_DIR en el archivo de configuración (portal.env) con la ruta de zoho-survey.',
  );
}

// ---------- carpeta de entradas (CSV subidos) ----------
// ENTRADAS_DIR, si está definida, manda siempre. Por defecto se usa una carpeta
// 'entradas' hermana de la carpeta servida (sitio/ → ../entradas), que es donde
// el proceso en Python del proyecto operativo espera los CSV que se suben.
export function resolverEntradas(sitio, dir = process.env.ENTRADAS_DIR) {
  const ruta = dir ? path.resolve(dir) : path.resolve(sitio, '..', 'entradas');
  mkdirSync(ruta, { recursive: true });
  return ruta;
}

// Tope de tamaño de un CSV subido (10 MB por defecto). Configurable con
// SUBIR_CSV_MAX_BYTES.
export const LIMITE_CSV_POR_DEFECTO = 10 * 1024 * 1024;

/** El tope de subida en bytes: SUBIR_CSV_MAX_BYTES si es válido, o el de por defecto. */
export function limiteCsv() {
  const n = Number(process.env.SUBIR_CSV_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : LIMITE_CSV_POR_DEFECTO;
}

// ---------- lectura del CSV subido ----------
// Las dos columnas que identifican un CSV de respuestas de Zoho.
export const COLUMNA_ID = 'ID de respuesta';
export const COLUMNA_ESTADO = 'Estado de respuesta';

// Mapa mínimo de los códigos altos de cp1252 (0x80–0x9F) para cuando Node no
// trae TextDecoder('windows-1252'). El resto de cp1252 coincide con latin1.
const CP1252_ALTOS = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

function decodificarCp1252(buffer) {
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    let salida = '';
    for (const byte of buffer) {
      salida += byte >= 0x80 && byte <= 0x9f
        ? CP1252_ALTOS[byte] || String.fromCharCode(byte)
        : String.fromCharCode(byte);
    }
    return salida;
  }
}

/**
 * Detecta la codificación del CSV y devuelve su texto ya decodificado.
 * - utf-8-sig: empieza con BOM (EF BB BF); se quita el BOM.
 * - utf-8: se decodifica de forma estricta.
 * - cp1252: cualquier otra cosa (el CSV exportado en Windows).
 */
export function decodificarCsv(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { codificacion: 'utf-8-sig', texto: buffer.subarray(3).toString('utf8') };
  }
  try {
    return { codificacion: 'utf-8', texto: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } catch {
    return { codificacion: 'cp1252', texto: decodificarCp1252(buffer) };
  }
}

/** El delimitador del CSV ("," ";" o tabulador) contando en la línea de cabeceras. */
export function detectarDelimitador(texto) {
  const linea = String(texto).split(/\r?\n/, 1)[0] || '';
  const candidatos = [',', ';', '\t'];
  let mejor = ',';
  let mejorCuenta = -1;
  for (const delim of candidatos) {
    let cuenta = 0;
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') enComillas = !enComillas;
      else if (c === delim && !enComillas) cuenta += 1;
    }
    if (cuenta > mejorCuenta) {
      mejorCuenta = cuenta;
      mejor = delim;
    }
  }
  return mejor;
}

/**
 * Parser CSV mínimo (RFC 4180): los campos entre comillas pueden contener el
 * delimitador, comillas dobles ("") y saltos de línea. Devuelve una matriz de
 * filas, cada una una matriz de celdas de texto.
 */
export function parsearCsv(texto, delim) {
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;
  const fuente = String(texto);

  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    if (enComillas) {
      if (c === '"') {
        if (fuente[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delim) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && fuente[i + 1] === '\n') i += 1;
      fila.push(campo);
      campo = '';
      filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/**
 * Resume las filas ya parseadas: cuántas filas de datos, cuántos identificadores
 * únicos ('ID de respuesta'), cuántas COMPLETED y cuántas PARTIAL ('Estado de
 * respuesta') y qué columnas obligatorias faltan.
 */
export function resumirCsv(filas) {
  const cabeceras = (filas[0] || []).map((h) => String(h).trim());
  const idxId = cabeceras.indexOf(COLUMNA_ID);
  const idxEstado = cabeceras.indexOf(COLUMNA_ESTADO);

  const faltantes = [];
  if (idxId === -1) faltantes.push(COLUMNA_ID);
  if (idxEstado === -1) faltantes.push(COLUMNA_ESTADO);

  const datos = filas.slice(1).filter((f) => f.some((c) => String(c).trim() !== ''));
  const ids = new Set();
  let completas = 0;
  let parciales = 0;

  for (const fila of datos) {
    if (idxId !== -1) {
      const id = String(fila[idxId] || '').trim();
      if (id) ids.add(id);
    }
    if (idxEstado !== -1) {
      const estado = String(fila[idxEstado] || '').trim().toUpperCase();
      if (estado === 'COMPLETED') completas += 1;
      else if (estado === 'PARTIAL') parciales += 1;
    }
  }

  return {
    filas: datos.length,
    identificadores_unicos: ids.size,
    completas,
    parciales,
    columnas_faltantes: faltantes,
  };
}

/** Sello de fecha y hora (YYYYMMDD-HHMMSS) para el nombre del archivo guardado. */
function selloDeTiempo(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return (
    String(fecha.getFullYear()) +
    dos(fecha.getMonth() + 1) +
    dos(fecha.getDate()) +
    '-' +
    dos(fecha.getHours()) +
    dos(fecha.getMinutes()) +
    dos(fecha.getSeconds())
  );
}

/** El nombre propuesto por el navegador, reducido a algo seguro para el disco. */
function nombreSeguro(nombre) {
  const base = String(nombre || '')
    .replace(/\.csv$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, 60) || 'subida';
}

/**
 * Guarda el CSV con un nombre que incluye la fecha y hora y NUNCA sobrescribe un
 * archivo anterior: si el nombre ya existe, prueba con un sufijo. Usa el modo
 * exclusivo ('wx') para que tampoco se pise en subidas simultáneas.
 */
export function guardarCsvUnico(dir, nombreOriginal, buffer) {
  const sello = selloDeTiempo();
  const base = nombreSeguro(nombreOriginal);
  for (let n = 0; n < 1000; n++) {
    const nombre = n === 0 ? `${sello}-${base}.csv` : `${sello}-${base}-${n}.csv`;
    try {
      writeFileSync(path.join(dir, nombre), buffer, { flag: 'wx' });
      return nombre;
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error('No se pudo encontrar un nombre libre para guardar el CSV.');
}

/**
 * Lee el cuerpo de la petición como bytes, con tope. Si se pasa del límite,
 * responde 413 y corta la lectura. Resuelve con el Buffer, o null si ya se
 * respondió (subida excesiva o error de red).
 */
function leerCuerpoCrudo(req, res, limite) {
  return new Promise((ok) => {
    const trozos = [];
    let total = 0;
    let terminado = false;

    req.on('data', (t) => {
      if (terminado) return;
      total += t.length;
      if (total > limite) {
        terminado = true;
        const mb = Math.round(limite / (1024 * 1024));
        enviarJson(res, 413, { error: `El archivo supera el límite permitido (${mb} MB).` });
        res.on('finish', () => req.destroy());
        ok(null);
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => {
      if (!terminado) ok(Buffer.concat(trozos));
    });
    req.on('error', () => {
      if (terminado) return;
      terminado = true;
      if (!res.headersSent) enviarJson(res, 400, { error: 'No se pudo leer el archivo subido.' });
      ok(null);
    });
  });
}

/** Atiende POST /api/subir-csv: recibe, guarda y resume el CSV (sin ETL). */
async function manejarSubirCsv(req, res, { sitio, entradas, limite }) {
  if (req.method !== 'POST') {
    return enviarJson(res, 405, { error: 'Método no permitido: /api/subir-csv solo atiende POST.' });
  }

  const buffer = await leerCuerpoCrudo(req, res, limite);
  if (!buffer) return; // ya se respondió (413 o error de lectura)

  if (!buffer.length) {
    return enviarJson(res, 400, { error: 'El cuerpo de la petición está vacío: falta el archivo CSV.' });
  }

  const { codificacion, texto } = decodificarCsv(buffer);
  const delimitador = detectarDelimitador(texto);
  const resumen = resumirCsv(parsearCsv(texto, delimitador));

  // Sin la columna que identifica cada respuesta, no es un CSV de Zoho.
  if (resumen.columnas_faltantes.includes(COLUMNA_ID)) {
    return enviarJson(res, 400, {
      error: `El archivo no parece un CSV de Zoho: no se encontró la columna "${COLUMNA_ID}".`,
      columnas_faltantes: resumen.columnas_faltantes,
    });
  }

  // Nombre original opcional (el navegador lo manda como ?nombre=...).
  let original = '';
  try {
    original = new URL(req.url, 'http://servidor.local').searchParams.get('nombre') || '';
  } catch {
    original = '';
  }

  const carpeta = resolverEntradas(sitio, entradas);
  const nombre = guardarCsvUnico(carpeta, original, buffer);

  return enviarJson(res, 200, {
    ok: true,
    archivo: nombre,
    carpeta,
    codificacion,
    delimitador,
    resumen,
  });
}

// ---------- utilidades de respuesta HTTP ----------
function enviarJson(res, codigo, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

function noEncontrado(res) {
  enviarJson(res, 404, { error: 'No se encontró el recurso solicitado.' });
}

// ---------- archivos estáticos ----------
async function servirArchivo(req, res, sitio) {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://servidor.local').pathname);
  } catch {
    return noEncontrado(res);
  }
  if (ruta === '/' || ruta === '') ruta = '/index.html';

  // Resuelve dentro de la carpeta servida: nada de subir por "..".
  const destino = path.normalize(path.join(sitio, ruta));
  if (destino !== sitio && !destino.startsWith(sitio + path.sep)) return noEncontrado(res);

  let info;
  try {
    info = await stat(destino);
  } catch {
    return noEncontrado(res);
  }
  // Sin listado de directorios: una carpeta solo se sirve si trae index.html.
  if (info.isDirectory()) {
    const indice = path.join(destino, 'index.html');
    try {
      const indexInfo = await stat(indice);
      if (!indexInfo.isFile()) return noEncontrado(res);
      return enviarArchivo(res, indice, indexInfo);
    } catch {
      return noEncontrado(res);
    }
  }
  if (!info.isFile()) return noEncontrado(res);
  return enviarArchivo(res, destino, info);
}

function enviarArchivo(res, destino, info) {
  res.writeHead(200, {
    'Content-Type': tipoMime(destino),
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
  });
  createReadStream(destino).pipe(res);
}

// ---------- manejador y servidor ----------
export function crearManejador({ sitio, entradas, limiteCsv: limite } = {}) {
  const limiteSubida = limite || limiteCsv();
  return function (req, res) {
    // Mismo origen: se permite el origen de la propia petición (no CORS abierto).
    if (req.headers && req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    const ruta = (req.url || '/').split('?')[0];
    if (ruta === '/api/subir-csv') {
      manejarSubirCsv(req, res, { sitio, entradas, limite: limiteSubida }).catch((error) => {
        console.error('Error inesperado en /api/subir-csv:', error && error.message);
        if (!res.headersSent) enviarJson(res, 500, { error: 'Error interno del servidor.' });
      });
      return;
    }
    servirArchivo(req, res, sitio).catch(() => noEncontrado(res));
  };
}

export function crearServidor({ sitio, entradas, limiteCsv } = {}) {
  return http.createServer(crearManejador({ sitio, entradas, limiteCsv }));
}

/** Las direcciones por las que se puede abrir el portal (localhost + red interna). */
export function direccionesDeEscucha(puerto) {
  const lista = [`http://localhost:${puerto}`];
  const interfaces = os.networkInterfaces();
  for (const nombre of Object.keys(interfaces)) {
    for (const dir of interfaces[nombre] || []) {
      if (dir.family === 'IPv4' && !dir.internal) lista.push(`http://${dir.address}:${puerto}`);
    }
  }
  return lista;
}

// ---------- arranque directo (node servidor-local.js) ----------
const esPrincipal =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esPrincipal) {
  let sitio;
  try {
    sitio = resolverSitio();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const puerto = Number(process.env.PUERTO) || 8000;
  const servidor = crearServidor({ sitio });
  servidor.on('error', (error) => {
    console.error(`No se pudo abrir el puerto ${puerto}: ${error.message}`);
    process.exit(1);
  });
  servidor.listen(puerto, () => {
    const direcciones = direccionesDeEscucha(puerto).join('  |  ');
    console.log(`Portal disponible en ${direcciones} — carpeta servida: ${sitio}`);
  });
}
