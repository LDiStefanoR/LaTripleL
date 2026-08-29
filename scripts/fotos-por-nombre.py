"""Búsqueda extra por nombre para productos sin foto de barcode."""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "off-cache.json"
NAME_CACHE = ROOT / "data" / "off-name-cache.json"
PRODUCTOS = ROOT / "data" / "productos.json"
UA = "LaTripleLMinimarket/1.0 (catalogo; contacto local)"

STOP = {
    "x", "gr", "g", "ml", "lt", "l", "kg", "un", "u", "pack", "paq", "lata",
    "doypack", "frasco", "nvo", "nuevo", "c", "de", "con", "sin",
}


def get_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            return json.loads(res.read().decode("utf-8", "replace"))
    except Exception:
        return None


def query_name(nombre: str) -> str:
    tokens = re.findall(r"[A-Za-zÁÉÍÓÚáéíóúÑñ0-9]+", nombre)
    terms = [t for t in tokens if t.lower() not in STOP and len(t) > 2][:5]
    if len(terms) < 2:
        return ""
    q = urllib.parse.urlencode(
        {
            "search_terms": " ".join(terms),
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": 1,
        }
    )
    payload = get_json(f"https://world.openfoodfacts.org/cgi/search.pl?{q}")
    if not payload:
        return ""
    products = payload.get("products") or []
    if not products:
        return ""
    p = products[0]
    return p.get("image_front_url") or p.get("image_url") or ""


def fallback_path(seccion: str) -> str:
    slug = seccion.lower().replace(" ", "-")
    return f"/recursos/imagenes-rubros/{slug}.jpg"


def main() -> None:
    barcode_cache = json.loads(CACHE.read_text(encoding="utf-8"))
    name_cache: dict[str, str] = {}
    if NAME_CACHE.exists():
        name_cache = json.loads(NAME_CACHE.read_text(encoding="utf-8"))
    productos = json.loads(PRODUCTOS.read_text(encoding="utf-8"))

    pending = []
    for p in productos:
        m = re.search(r"EAN (\S+)", p.get("descripcion") or "")
        ean = m.group(1) if m else ""
        if barcode_cache.get(ean):
            continue
        if str(p.get("imagen", "")).startswith("http"):
            continue
        if p["nombre"] in name_cache:
            continue
        pending.append(p["nombre"])

    print(f"Buscar por nombre: {len(pending)}")
    hits = 0

    def work(nombre: str) -> tuple[str, str]:
        return nombre, query_name(nombre)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(work, n) for n in pending]
        for i, fut in enumerate(as_completed(futs), 1):
            nombre, url = fut.result()
            name_cache[nombre] = url
            if url:
                hits += 1
            if i % 30 == 0:
                NAME_CACHE.write_text(json.dumps(name_cache, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  {i}/{len(pending)} hits {hits}")

    NAME_CACHE.write_text(json.dumps(name_cache, ensure_ascii=False, indent=2), encoding="utf-8")

    applied = 0
    for p in productos:
        m = re.search(r"EAN (\S+)", p.get("descripcion") or "")
        ean = m.group(1) if m else ""
        img = barcode_cache.get(ean) or name_cache.get(p["nombre"]) or ""
        if img:
            p["imagen"] = img
            applied += 1
        else:
            p["imagen"] = fallback_path(p["seccion"])
    PRODUCTOS.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Fotos reales: {applied}/{len(productos)}")


if __name__ == "__main__":
    main()
