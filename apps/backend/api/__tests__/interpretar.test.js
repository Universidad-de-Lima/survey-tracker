import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let fetchMock;

globalThis.fetch = (...args) => fetchMock(...args);


const { default: interpretar, primerObjeto, normalizarConsulta, normalizarPlan, armarMensaje, textoDeRespuesta, MODELOS, INSTRUCCIONES_RESPUESTA, cadenaDeModelos, USAR_NVIDIA } = await import('../interpretar.js');

// Las pruebas del respaldo prueban la cadena completa: se enciende NVIDIA solo aqui, por variable de
// entorno. El comportamiento por defecto (NVIDIA apagado) se comprueba en la ultima prueba del archivo.
beforeEach(() => { process.env.INTERPRETAR_USAR_NVIDIA = '1'; });

/** Respuesta estilo NVIDIA (formato OpenAI). */
function modelo(contenido, { status = 200 } = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content: contenido } }] }),
  });
}

/** Respuesta estilo Google (generateContent). */
function modeloGoogle(contenido, { status = 200 } = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ candidates: [{ content: { parts: [{ text: contenido }] } }] }),
  });
}

const FORMULARIO = JSON.stringify({
  se_puede: true,
  operacion: 'porcentaje',
  periodo: 'Graduados Pregrado 2026',
  filtros: [{ pregunta: 'Carrera', valores: ['Economía'] }],
  pregunta_objetivo: 'Situación laboral',
  valores_objetivo: ['Trabajador dependiente'],
  entidad: '',
  orden: '',
  motivo: '',
});

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
  process.env.GOOGLE_API_KEY = 'llave-google-de-prueba';
  process.env.NVIDIA_API_KEY = 'llave-nvidia-de-prueba';
});

describe('formulario de la pregunta (contexto + menú)', () => {
  it('saca el objeto JSON aunque venga con texto alrededor', () => {
    const crudo = primerObjeto('Claro:\n{"se_puede":true,"operacion":"nps"}\nEspero que ayude.');

    expect(crudo).toEqual({ se_puede: true, operacion: 'nps' });
  });

  it('arma el mensaje con contexto, menú y pregunta, en ese orden', () => {
    const mensaje = armarMensaje('¿Cuántos fueron?', '## Qué es\n- Portal', '## Menú — X\n- Carrera');

    expect(mensaje.indexOf('## Qué es')).toBeLessThan(mensaje.indexOf('## Menú'));
    expect(mensaje.indexOf('## Menú')).toBeLessThan(mensaje.indexOf('## Pregunta'));
    expect(mensaje).toContain('¿Cuántos fueron?');
  });

  it('solo acepta las operaciones de la lista y limpia el resto', () => {
    const f = normalizarConsulta({
      se_puede: true,
      operacion: 'NPS',
      periodo: ' Graduados Pregrado 2026 ',
      filtros: [{ pregunta: ' Carrera ', valores: [' Economía ', ''] }],
      pregunta_objetivo: ' Situación laboral ',
      valores_objetivo: [' Trabajador dependiente '],
      entidad: ' Psicología ',
      orden: 'PEOR',
      motivo: '',
    });

    expect(f).toEqual({
      se_puede: true,
      operacion: 'nps',
      periodo: 'Graduados Pregrado 2026',
      filtros: [{ pregunta: 'Carrera', valores: ['Economía'] }],
      pregunta_objetivo: 'Situación laboral',
      valores_objetivo: ['Trabajador dependiente'],
      entidad: 'Psicología',
      orden: 'peor',
      motivo: '',
    });
    expect(normalizarConsulta({ operacion: 'inventada' })).toBeNull();
    expect(normalizarConsulta(null)).toBeNull();
  });

  it('el paso "plan" devuelve qué datos leer (períodos, preguntas y filtros)', async () => {
    fetchMock.mockReturnValue(modeloGoogle('{"se_puede":true,"periodos":["Estudiantes Pregrado 2026-1"],"preguntas":["Carrera"],"filtros":[{"pregunta":"Ciclo","valores":["10° Ciclo"]}],"motivo":""}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Qué carreras hay en 10° ciclo?', paso: 'plan' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.plan.preguntas).toEqual(['Carrera']);
    expect(res.body.plan.filtros[0].pregunta).toBe('Ciclo');
    const enviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(enviado.systemInstruction.parts[0].text).toContain('QUÉ DATOS HAY QUE LEER');
  });

  it('la instrucción del paso "plan" distingue la columna por la que se agrupa de la pregunta que se mide', async () => {
    fetchMock.mockReturnValue(modeloGoogle('{"se_puede":true,"periodos":[],"preguntas":[],"filtros":[],"motivo":""}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: 'Compara las carreras del 2026-1', paso: 'plan' } }, res);

    expect(res.statusCode).toBe(200);
    const instruccion = JSON.parse(fetchMock.mock.calls[0][1].body).systemInstruction.parts[0].text;

    // Los dos papeles, dichos en general: columna por la que se agrupa / pregunta que se mide.
    expect(instruccion).toMatch(/columnas?[^.\n]*agrup/i);
    expect(instruccion).toMatch(/preguntas?[^.\n]*se miden/i);
    // Comparar entre categorías: se agrupa por la columna, no se lee la pregunta de satisfacción parecida,
    // y no se niega cuando piden comparar.
    expect(instruccion).toMatch(/comparar entre categor/i);
    expect(instruccion).toMatch(/no debes leer la pregunta/i);
    expect(instruccion).toMatch(/no te niegues/i);
    // Es UNA regla general, no una instrucción por pregunta (una lista de casos).
    const casos = instruccion
      .split('\n')
      .filter((l) => /^\s*-\s/.test(l) && /columna/i.test(l) && /(medid|se mide)/i.test(l));
    expect(casos.length).toBeLessThanOrEqual(1);
  });

  it('el paso "respuesta" redacta con los datos que le manda el portal', async () => {
    fetchMock.mockReturnValue(modeloGoogle('```\n# En 2025-2 hubo 3998 respuestas.\nFuente: Estudiantes Pregrado 2025-2\n```'));
    const res = createRes();

    await interpretar({
      method: 'POST',
      body: { pregunta: '¿Cuántos respondieron?', paso: 'respuesta', bloques: '## Datos — Estudiantes Pregrado 2025-2\n- Respuestas: 3998' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.respuesta).toContain('3998');
    expect(res.body.respuesta).toContain('Fuente:');
    expect(res.body.respuesta).not.toContain('```');
    const enviado = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(enviado.contents[0].parts[0].text).toContain('## Datos');
    expect(enviado.systemInstruction.parts[0].text).toContain('SOLO esos datos');
  });

  it('la instrucción del paso "respuesta" pide la tabla y ya no la prohíbe', () => {
    // la instrucción pide tabla cuando se comparan categorías, y ya no la prohíbe
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/agrega al final una tabla/);
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/POCAS columnas y muchas filas/);
    expect(INSTRUCCIONES_RESPUESTA).not.toMatch(/no armes tablas/);
    expect(INSTRUCCIONES_RESPUESTA).not.toMatch(/máximo de columnas|máximo 3 columnas/i);
  });

  it('la instrucción del paso "respuesta" exige la tabla completa al listar categorías y sin columnas inventadas', () => {
    // Al listar categorías (carreras, facultades, ciclos...) van TODAS las que estén en los datos: no se omite ninguna.
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/lista categorías/);
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/van TODAS las que estén en los datos/);
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/no se omite ninguna/);
    // Con demasiadas categorías se avisa en el texto y se dice cuáles quedaron fuera de la tabla.
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/más de veinte/);
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/quedaron fuera/);
    // Las columnas y las cifras salen de los datos: no se inventan columnas ni se reformatean las cifras.
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/no inventes columnas/);
    expect(INSTRUCCIONES_RESPUESTA).toMatch(/tal como vienen en los datos/);
  });

  it('el plan recorta listas disparatadas (períodos, preguntas y filtros)', () => {
    const p = normalizarPlan({
      periodos: ['a', '', 'b', 'c', 'd'],
      preguntas: ['x'],
      filtros: [{ pregunta: '', valores: ['y'] }, { pregunta: 'Carrera', valores: [] }],
    });

    expect(p.periodos).toEqual(['a', 'b']);
    expect(p.preguntas).toEqual(['x']);
    expect(p.filtros).toEqual([]);
  });

  it('no deja pasar órdenes que no correspondan ni filtros vacíos', () => {
    const f = normalizarConsulta({ operacion: 'nps', orden: 'el peor', filtros: [{ pregunta: '', valores: [] }] });

    expect(f.orden).toBe('');
    expect(f.filtros).toEqual([]);
  });

  it('lee la respuesta de cada proveedor como corresponde', () => {
    expect(textoDeRespuesta('google', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab');
    expect(textoDeRespuesta('nvidia', { choices: [{ message: { content: 'hola' } }] })).toBe('hola');
    expect(textoDeRespuesta('google', null)).toBe('');
  });

  it('arranca con el modelo de Google, con la dirección y la forma que Google pide', async () => {
    fetchMock.mockReturnValue(modeloGoogle(FORMULARIO));
    const res = createRes();

    await interpretar({
      method: 'POST',
      body: { pregunta: '¿Cuántos trabajan?', contexto: '## Qué es\n- Portal', menu: '## Menú — X\n- Situación laboral' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.pregunta_objetivo).toBe('Situación laboral');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('generativelanguage.googleapis.com');
    expect(String(url)).toContain(MODELOS[0].id);
    const enviado = JSON.parse(opciones.body);
    expect(enviado.systemInstruction.parts[0].text).toContain('asistente de datos');
    expect(enviado.contents[0].parts[0].text).toContain('## Qué es');
    expect(enviado.contents[0].parts[0].text).toContain('## Menú');
    expect(enviado.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(400);
    expect(enviado.messages).toBeUndefined();
  });

  it('si Google no contesta, sigue con NVIDIA (petición estilo OpenAI)', async () => {
    fetchMock
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, json: async () => ({}) }))
      .mockReturnValueOnce(modelo(FORMULARIO));
    const res = createRes();

    await interpretar({
      method: 'POST',
      body: { pregunta: '¿Cuántos trabajan?', contexto: '## Qué es', menu: '## Menú — X' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opciones] = fetchMock.mock.calls[1];
    expect(String(url)).toContain('integrate.api.nvidia.com');
    const enviado = JSON.parse(opciones.body);
    expect(enviado.messages[0].content).toContain('asistente de datos');
    expect(enviado.messages[1].content).toContain('## Menú');
    expect(enviado.max_tokens).toBeGreaterThanOrEqual(400);
  });

  it('si falta la llave de Google, arranca directo con NVIDIA', async () => {
    delete process.env.GOOGLE_API_KEY;
    fetchMock.mockReturnValue(modelo(FORMULARIO));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuántos trabajan?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain('integrate.api.nvidia.com');
  });

  it('marca "se_puede" false cuando la pregunta no es de las encuestas', async () => {
    fetchMock.mockReturnValue(modeloGoogle('{"se_puede":false,"operacion":"ninguna","motivo":"No es de las encuestas."}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Qué hora es?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.se_puede).toBe(false);
    expect(res.body.consulta.motivo).toContain('encuestas');
  });

  it('si el primer modelo falla, prueba el siguiente', async () => {
    fetchMock
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, json: async () => ({}) }))
      .mockReturnValueOnce(modelo('{"se_puede":true,"operacion":"nps","periodo":"2026-1"}'));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.operacion).toBe('nps');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('si un modelo se queda colgado, se corta y prueba el siguiente', async () => {
    process.env.INTERPRETAR_TIMEOUT_MS = '30';
    let primera = true;
    fetchMock.mockImplementation(() => {
      if (primera) {
        primera = false;
        return new Promise((ok, mal) => {
          const t = setTimeout(() => mal(Object.assign(new Error('abortado'), { name: 'AbortError' })), 20);
          void t; void ok;
        });
      }
      return modelo('{"se_puede":true,"operacion":"nps","periodo":"2026-1"}');
    });
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);
    delete process.env.INTERPRETAR_TIMEOUT_MS;

    expect(res.statusCode).toBe(200);
    expect(res.body.consulta.operacion).toBe('nps');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBeTruthy();
  });

  it('si ningún modelo responde, avisa sin romper', async () => {
    fetchMock.mockReturnValue(modelo('no es json', { status: 200 }));
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuántos fueron?' } }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('sin ninguna llave avisa en vez de intentar', async () => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    const res = createRes();

    await interpretar({ method: 'POST', body: { pregunta: '¿Cuál es el NPS?' } }, res);

    expect(res.statusCode).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza los métodos que no corresponden', async () => {
    const res = createRes();

    await interpretar({ method: 'GET' }, res);

    expect(res.statusCode).toBe(405);
  });
});

it('por defecto la cadena es solo Google y la respuesta prohibe el razonamiento', () => {
  expect(USAR_NVIDIA).toBe(false);
  expect(MODELOS.map((m) => m.proveedor)).toEqual(['google']);
  delete process.env.INTERPRETAR_USAR_NVIDIA;
  expect(cadenaDeModelos().length).toBe(1);
  expect(INSTRUCCIONES_RESPUESTA).toMatch(/No escribas tu razonamiento/);
  expect(INSTRUCCIONES_RESPUESTA).toMatch(/empieza directo con ella/);
});
