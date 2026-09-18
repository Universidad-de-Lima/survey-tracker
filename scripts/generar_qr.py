#!/usr/bin/env python3
"""Genera el QR único de la campaña.

Se ejecuta en GitHub Actions: no se instala nada en el proyecto ni se toca pnpm.
El único requisito es `qrcode`, que se instala en el propio runner con pip.

El QR apunta SIEMPRE al contador (/api/qr-scan), que cuenta el escaneo y redirige a
la encuesta de Zoho. Es el mismo QR toda la campaña: se proyecta, los alumnos lo
escanean y el panel muestra el avance hasta que "Pendientes" llega a cero.

Uso:
    python scripts/generar_qr.py --url https://qr-smoky-theta.vercel.app/api/qr-scan
"""

import argparse
import os
import sys
from urllib.parse import urlparse

URL_POR_DEFECTO = "https://qr-smoky-theta.vercel.app/api/qr-scan"
SALIDA_POR_DEFECTO = "apps/frontend/public/qr"
NOMBRE_POR_DEFECTO = "encuesta.png"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("QR_URL", URL_POR_DEFECTO))
    parser.add_argument("--salida", default=SALIDA_POR_DEFECTO)
    parser.add_argument("--nombre", default=NOMBRE_POR_DEFECTO)
    args = parser.parse_args()

    url = args.url.strip()
    partes = urlparse(url)

    # Una URL relativa daría un QR inservible, y el fallo se descubriría proyectando
    # en el salón. Mejor caer al destino conocido y dejarlo escrito en el log.
    if partes.scheme not in ("http", "https") or not partes.netloc:
        print(f"AVISO: {url!r} no es una URL absoluta; se usa {URL_POR_DEFECTO}")
        url = URL_POR_DEFECTO

    import qrcode  # se instala en el runner; no forma parte del proyecto

    os.makedirs(args.salida, exist_ok=True)
    destino = os.path.join(args.salida, args.nombre)

    # box_size alto a propósito: el QR se proyecta en un ecrán y tiene que leerse
    # desde las últimas filas del salón.
    codigo = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=20,
        border=4,
    )
    codigo.add_data(url)
    codigo.make(fit=True)
    codigo.make_image(fill_color="black", back_color="white").save(destino)

    print(f"QR generado en {destino}")
    print(f"  apunta a: {url}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
