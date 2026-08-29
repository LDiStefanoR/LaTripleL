"""Reconsulta barcodes vacíos con reintentos (el primer pase se rate-limiteó)."""
from __future__ import annotations

import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "off-cache.json"
PRODUCTOS = ROOT / "data" / "productos.json"
UA = "LaTripleLMinimarket/1.0 (catalogo; contacto local)"

APIS = [
    "https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=image_front_url,image_url,image_front_small_url",
]


def get_json(url: str, timeout: float = 15) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8", "replace"))
    except Exception as e:
        return {"_error": str(e)}


def image_of(payload: dict | None) -> str:
    if not payload or payload.get("status") != 1:
        return ""
    prod = payload.get("product") or {}
    return (
        prod.get("image_front_url")
        or prod.get("image_url")
        or prod.get("image_front_small_url")
        or ""
    )


def lookup(code: str) -> str:
    digits = re.sub(r"\D", "", code)
    if len(digits) < 8:
        return ""
    for tmpl in APIS:
        for attempt in range(3):
            payload = get_json(tmpl.format(code=digits))
            if payload and payload.get("_error"):
                time.sleep(1.2 * (attempt + 1))
                continue
            url = image_of(payload)
            if url:
                return url
            break
        time.sleep(0.15)
    return ""


def fallback_path(seccion: str) -> str:
    slug = seccion.lower().replace(" ", "-")
    return f"/recursos/imagenes-rubros/{slug}.jpg"


def main() -> None:
    cache = json.loads(CACHE.read_text(encoding="utf-8"))
    pending = [
        k
        for k, v in cache.items()
        if not v and len(re.sub(r"\D", "", k)) >= 8
    ]
    pending.sort(key=lambda k: (0 if k.startswith(("779", "844", "762", "750")) else 1, k))
    print(f"Pendientes: {len(pending)}")
    hits = 0
    for i, code in enumerate(pending, 1):
        url = lookup(code)
        cache[code] = url
        if url:
            hits += 1
        if i % 20 == 0 or i == len(pending):
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  {i}/{len(pending)} hits este pase {hits}")
        time.sleep(0.12)

    productos = json.loads(PRODUCTOS.read_text(encoding="utf-8"))
    for p in productos:
        m = re.search(r"EAN (\S+)", p.get("descripcion") or "")
        ean = m.group(1) if m else ""
        img = cache.get(ean) if ean else ""
        if img:
            p["imagen"] = img
        elif not str(p.get("imagen", "")).startswith("http"):
            p["imagen"] = fallback_path(p["seccion"])
    PRODUCTOS.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
    con = sum(1 for p in productos if str(p["imagen"]).startswith("http"))
    print(f"Productos con foto real: {con}/{len(productos)}")


if __name__ == "__main__":
    main()
