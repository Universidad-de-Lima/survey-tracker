import { beforeEach, describe, expect, it, vi } from 'vitest';

let setMock;
let onceMock;
let updateMock;
let refMock;

globalThis.dbStore = { current: { ref: (...args) => refMock(...args) } };

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { clavesDeTiempo, contarPregunta, leerCupo } = await import('../cuota.js');

beforeEach(() => {
  setMock = vi.fn().mockResolvedValue();
  onceMock = vi.fn().mockResolvedValue({ val: () => null, forEach: () => {} });
  updateMock = vi.fn().mockResolvedValue();
  refMock = vi.fn(() => ({
    set: setMock,
    once: onceMock,
    update: updateMock,
    orderByKey: () => ({ endAt: () => ({ once: onceMock }) }),
  }));
});

describe('contador de cupo del intérprete', () => {
  it('usa la hora del Pacífico para el día y el minuto', () => {
    // 2026-09-30 04:30 UTC = 2026-09-29 21:30 en el Pacífico (UTC-7).
    expect(clavesDeTiempo(new Date('2026-09-30T04:30:00Z'))).toEqual({
      dia: '2026-09-29',
      minuto: '2026-09-29 21:30',
    });
    // Justo cuando Google reinicia el cupo (medianoche del Pacífico).
    expect(clavesDeTiempo(new Date('2026-09-30T07:00:00Z'))).toEqual({
      dia: '2026-09-30',
      minuto: '2026-09-30 00:00',
    });
  });

  it('suma 1 al minuto y al día', async () => {
    await contarPregunta(new Date('2026-09-30T04:30:00Z'));

    const rutas = refMock.mock.calls.map((c) => c[0]);
    expect(rutas).toContain('cuota/minuto/2026-09-29 21:30');
    expect(rutas).toContain('cuota/dia/2026-09-29');
    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock.mock.calls[0][0]).toEqual({ __increment__: 1 });
  });

  it('no rompe nada si Firebase falla', async () => {
    refMock = vi.fn(() => ({ set: () => { throw new Error('sin conexión'); } }));
    globalThis.dbStore.current = { ref: (...args) => refMock(...args) };

    await expect(contarPregunta()).resolves.toBeUndefined();
    globalThis.dbStore.current = { ref: (...args) => refMock(...args) };
  });

  it('lee el uso del minuto y del día', async () => {
    onceMock = vi.fn()
      .mockResolvedValueOnce({ val: () => 3 })
      .mockResolvedValueOnce({ val: () => 27 });
    refMock = vi.fn(() => ({ once: onceMock, set: setMock, update: updateMock }));

    await expect(leerCupo(new Date('2026-09-30T04:30:00Z'))).resolves.toEqual({ usadoMinuto: 3, usadoDia: 27 });
  });

  it('devuelve ceros si no puede leer', async () => {
    refMock = vi.fn(() => ({ once: () => { throw new Error('sin conexión'); } }));

    await expect(leerCupo()).resolves.toEqual({ usadoMinuto: 0, usadoDia: 0 });
  });
});
