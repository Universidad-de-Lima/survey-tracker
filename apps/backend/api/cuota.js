// ============================================================
// Cupo del intérprete del portal (ítem 1.9)
// ------------------------------------------------------------
// GET -> { usadoMinuto, limiteMinuto, usadoDia, limiteDia }
// Solo lectura y sin datos personales: dos números.
// ============================================================

import { applyCors } from '../lib/sessions.js';
import { leerCupo, LIMITE_MINUTO, LIMITE_DIA } from '../lib/cuota.js';

export default async (req, res) => {
  applyCors(res, { methods: 'GET, OPTIONS' });

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { usadoMinuto, usadoDia } = await leerCupo();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ usadoMinuto, limiteMinuto: LIMITE_MINUTO, usadoDia, limiteDia: LIMITE_DIA });
};
