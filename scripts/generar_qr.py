#!/usr/bin/env python3
"""Genera un QR por salon a partir de data/salones.csv.

Se ejecuta en GitHub Actions: aqui NO se instala nada en el proyecto ni se toca
pnpm. El unico requisito es el paquete `qrcode`, que se instala en el propio
runner con pip antes de llamar a este script.

Deja los PNG y un indice JSON en apps/frontend/public/qr/, de donde los recoge
el build de Vite para publicarlos en GitHub Pages.

Uso:
    python scripts/generar_qr.py [--csv data/salones.csv] [--salida apps/frontend/public/qr]
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

BASE_POR_DEFECTO = "https://qr-smoky-theta.vercel.app/api/qr-scan"

# Si el CSV trae alguna de estas cabeceras, se usa esa columna como identificador
# del salon. Si no, se usa la primera columna.
COLUMNAS_PREFERIDAS = ("salon", "salón", "aula", "sesion", "sesión", "encuestado", "nombre")

# El backend sanea '.', '#', '$', '[', ']' y '/' a '_' y recorta a 64 caracteres.
# Aqui ademas bajamos a minusculas y cambiamos todo lo demas por guiones: el id
# queda url-safe y el QR sale menos denso, que es mejor para proyectarlo.
MAX_LARGO_ID = 48


def normalizar_id(texto):
    sin_acentos = "".join(
        caracter
        for caracter in unicodedata.normalize("NFKD", str(texto))
        if not unicodedata.combining(caracter)
    )
    limpio = re.sub(r"[^A-Za-z0-9]+", "-", sin_acentos).strip("-").lower()

    return limpio[:MAX_LARGO_ID]


def leer_filas(ruta):
    with open(ruta, encoding="utf-8-sig", newline="") as archivo:
        muestra = archivo.read(4096)
        archivo.seek(0)
        try:
            delimitador = csv.Sniffer().sniff(muestra, delimiters=",;\t|").delimiter
        except csv.Error:
            delimitador = ","
        return list(csv.reader(archivo, delimiter=delimitador))


def elegir_columna(cabeceras):
    for indice, cabecera in enumerate(cabeceras):
        if cabecera.strip().lower() in COLUMNAS_PREFERIDAS:
            return indice, cabecera.strip()

    indice = 0
    nombre = cabeceras[0].strip() if cabeceras else "(primera columna)"

    return indice, nombre


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default="data/salones.csv")
    parser.add_argument("--salida", default="apps/frontend/public/qr")
    parser.add_argument("--base", default=os.environ.get("QR_BASE_URL", BASE_POR_DEFECTO))
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(f"AVISO: {args.csv} no existe todavia; no se generan QR y el despliegue continua.")
        return 0

    filas = [fila for fila in leer_filas(args.csv) if any(celda.strip() for celda in fila)]
    if len(filas) < 2:
        print(f"AVISO: {args.csv} no tiene filas de datos; no se generan QR.")
        return 0

    cabeceras, datos = filas[0], filas[1:]
    indice, nombre_columna = elegir_columna(cabeceras)
    print(f"Columna usada como identificador de salon: {nombre_columna!r} (posicion {indice})")

    import qrcode  # se instala en el runner; no forma parte del proyecto

    os.makedirs(args.salida, exist_ok=True)

    salones = []
    vistos = set()

    for numero_linea, fila in enumerate(datos, start=2):
        if indice >= len(fila) or not fila[indice].strip():
            print(f"  linea {numero_linea}: sin valor en {nombre_columna!r}, se omite")
            continue

        crudo = fila[indice].strip()
        identificador = normalizar_id(crudo)

        if not identificador:
            print(f"  linea {numero_linea}: {crudo!r} no produce un id valido, se omite")
            continue

        if identificador in vistos:
            print(f"  AVISO linea {numero_linea}: {crudo!r} repite el id {identificador!r}, se omite")
            continue

        vistos.add(identificador)

        url = f"{args.base}?s={identificador}"
        archivo_png = f"{identificador}.png"

        codigo = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=12,
            border=3,
        )
        codigo.add_data(url)
        codigo.make(fit=True)
        codigo.make_image(fill_color="black", back_color="white").save(
            os.path.join(args.salida, archivo_png)
        )

        salones.append(
            {
                "id": identificador,
                "nombre": crudo,
                "url": url,
                "archivo": archivo_png,
            }
        )
        print(f"  {crudo}  ->  {archivo_png}")

    indice_json = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "base": args.base,
        "columna": nombre_columna,
        "total": len(salones),
        "salones": salones,
    }

    with open(os.path.join(args.salida, "salones.json"), "w", encoding="utf-8") as archivo_json:
        json.dump(indice_json, archivo_json, ensure_ascii=False, indent=2)

    print(f"\nGenerados {len(salones)} QR en {args.salida}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
