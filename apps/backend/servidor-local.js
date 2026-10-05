// ============================================================
// Servidor local del portal de encuestas + intérprete de IA.
// ------------------------------------------------------------
// Reemplaza a Vercel para correr todo en la PC del usuario, sin dependencias:
// usa SOLO los módulos estándar de Node (http, fs, path, url, os).
//
// Qué hace:
//   1. Sirve por HTTP la carpeta de archivos estáticos del portal (SITIO_DIR).
//      Sirve "/" como index.html, con el tipo MIME correcto, 404 claro si el
//      archivo no existe y SIN listar directorios.
//   2. Atiende POST /api/interpretar reutilizando tal cual el handler que ya
//      corre en Vercel (apps/backend/api/interpretar.js): se le pasa un
//      "req" con el cuerpo ya parseado y un "res" con status()/json()/
//      setHeader()/end(), y el handler escribe la respuesta real.
//
// Cómo arranca el usuario (ver docs/servidor-local.md):
//   node --env-file="C:\ruta\ia.env" apps/backend/servidor-local.js
// Ese archivo .env vive FUERA de todo repositorio y contiene:
//   GOOGLE_API_KEY=...
//   SITIO_DIR=Q:\ANALISTA DE DATOS\1. GitHub\survey-test\zoho-survey
//   PUERTO=8000
// La clave NUNCA se lee de un archivo del repositorio ni se imprime.
//
// Compatibilidad: Node 26 (y cualquier Node >= 18 con fetch global).
// ============================================================

import http from 'node:http';
import os from 'node:os';
import { stat } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import interpretar from './api/interpretar.js';

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
      : 'No se encontró la carpeta del portal. Define SITIO_DIR en el archivo de configuración (ia.env) con la ruta de zoho-survey.',
  );
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

// ---------- /api/interpretar ----------
/** Lee todo el cuerpo de la petición como texto. */
function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => ok(Buffer.concat(trozos).toString('utf8')));
    req.on('error', mal);
  });
}

/**
 * Doble de la respuesta de Vercel: el handler de interpretar.js escribe con
 * status()/setHeader()/json()/end() y este objeto lo traduce al http real.
 */
function respuestaAdaptada(res) {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(clave, valor) {
      this.headers[clave] = valor;
      return this;
    },
    json(datos) {
      const cuerpo = JSON.stringify(datos);
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.setHeader('Content-Length', Buffer.byteLength(cuerpo));
      res.writeHead(this.statusCode, this.headers);
      res.end(cuerpo);
    },
    end(cuerpo) {
      res.writeHead(this.statusCode, this.headers);
      res.end(cuerpo === undefined ? undefined : String(cuerpo));
    },
  };
}

async function manejarInterpretar(req, res) {
  if (req.method !== 'POST') {
    return enviarJson(res, 405, { error: 'Método no permitido: /api/interpretar solo atiende POST.' });
  }

  let cuerpo;
  try {
    const texto = await leerCuerpo(req);
    cuerpo = JSON.parse(texto);
  } catch {
    return enviarJson(res, 400, { error: 'El cuerpo de la petición no es JSON válido.' });
  }

  // La clave se lee en cada petición y NUNCA se imprime. Sin clave el servidor
  // sigue arrancado; esta ruta responde un error claro.
  if (!process.env.GOOGLE_API_KEY) {
    return enviarJson(res, 500, {
      error: 'Falta configurar GOOGLE_API_KEY en el servidor local. Agrégala al archivo ia.env y reinicia el portal.',
    });
  }

  try {
    await interpretar({ method: 'POST', headers: req.headers, body: cuerpo }, respuestaAdaptada(res));
  } catch (error) {
    // Nunca debe caerse por una excepción: se registra y se responde 500 claro.
    console.error('Error al atender /api/interpretar:', error && error.message);
    if (!res.headersSent) {
      enviarJson(res, 500, { error: 'No se pudo interpretar la pregunta.' });
    }
  }
}

// ---------- manejador y servidor ----------
export function crearManejador({ sitio }) {
  return function (req, res) {
    // Mismo origen: se permite el origen de la propia petición (no CORS abierto).
    if (req.headers && req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    const ruta = (req.url || '/').split('?')[0];
    if (ruta === '/api/interpretar') {
      manejarInterpretar(req, res).catch((error) => {
        console.error('Error inesperado en /api/interpretar:', error && error.message);
        if (!res.headersSent) enviarJson(res, 500, { error: 'Error interno del servidor.' });
      });
      return;
    }
    servirArchivo(req, res, sitio).catch(() => noEncontrado(res));
  };
}

export function crearServidor({ sitio }) {
  return http.createServer(crearManejador({ sitio }));
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
    console.log(
      `Portal disponible en ${direcciones} — carpeta servida: ${sitio}` +
        (process.env.GOOGLE_API_KEY ? '' : ' (aviso: falta GOOGLE_API_KEY; /api/interpretar no responderá)'),
    );
  });
}
