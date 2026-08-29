"""Segundo pase: búsqueda laxa en supermercados + Wikipedia/Wikimedia para cigarrillos y vapers."""
from __future__ import annotations

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTOS = ROOT / "data" / "productos.json"
DEST = ROOT / "recursos" / "imagenes-productos"
PUBLIC = ROOT / "public" / "recursos" / "imagenes-productos"

UA_STORE = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
UA_WIKI = "LaTripleLMinimarket/1.0 (catalogo; https://localhost)"

STORES = [
    "https://www.jumbo.com.ar",
    "https://www.disco.com.ar",
    "https://www.carrefour.com.ar",
]

STOP = {
    "x", "gr", "g", "ml", "lt", "l", "kg", "un", "u", "pack", "paq", "lata",
    "doypack", "frasco", "nvo", "nuevo", "c", "de", "con", "sin", "para",
    "sabor", "ud", "uds", "uni", "unid", "puff", "k",
}

CIG_WIKI = {
    "marlboro": "Marlboro_(cigarette)",
    "camel": "Camel_(cigarette)",
    "lucky": "Lucky_Strike",
    "chesterfield": "Chesterfield_(cigarette)",
    "philip": "Philip_Morris_(cigarette)",
    "philips": "Philip_Morris_(cigarette)",
    "phipis": "Philip_Morris_(cigarette)",
    "morris": "Philip_Morris_(cigarette)",
}

SKIP = {"prestamo dinero efectivo $1.000", "envio a domicilio", "gramo"}


def get_json(url: str, headers: dict, timeout: float = 14):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8", "replace"))
    except Exception:
        return None


def tokens(texto: str) -> list[str]:
    s = unicodedata.normalize("NFD", texto.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    parts = re.findall(r"[a-z0-9]+", s)
    return [p for p in parts if p not in STOP and len(p) > 2]


def imagen_vtex(prod: dict) -> str:
    items = prod.get("items") or []
    if not items:
        return ""
    images = items[0].get("images") or []
    if not images:
        return ""
    url = images[0].get("imageUrl") or ""
    return str(url).split("?")[0]


def laxo(nombre: str, titulo: str) -> bool:
    a = tokens(nombre)
    if not a:
        return False
    t = unicodedata.normalize("NFD", titulo.lower())
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return a[0] in t


def buscar_super(nombre: str) -> str:
    toks = tokens(nombre)
    queries = []
    if toks:
        queries.append(" ".join(toks[:4]))
        queries.append(" ".join(toks[:2]))
        queries.append(toks[0])
    seen = []
    for q in queries:
        if q in seen or len(q) < 3:
            continue
        seen.append(q)
        path = urllib.parse.quote(q)
        for store in STORES:
            data = get_json(
                f"{store}/api/catalog_system/pub/products/search/{path}",
                {"User-Agent": UA_STORE, "Accept": "application/json"},
            )
            if not isinstance(data, list):
                continue
            for prod in data[:12]:
                titulo = f"{prod.get('productName','')} {prod.get('brand','')}"
                if laxo(nombre, titulo):
                    url = imagen_vtex(prod)
                    if url:
                        return url
    return ""


def wiki_original(title: str) -> str:
    data = get_json(
        f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}",
        {"User-Agent": UA_WIKI, "Accept": "application/json"},
    )
    if not data:
        return ""
    orig = (data.get("originalimage") or {}).get("source") or ""
    thumb = (data.get("thumbnail") or {}).get("source") or ""
    url = orig or thumb
    if url and "Logo.svg" in url:
        return ""
    return url.split("?")[0] if url else ""


def commons_search(query: str) -> str:
    data = get_json(
        "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="
        + urllib.parse.quote(query)
        + "&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&format=json",
        {"User-Agent": UA_WIKI},
    )
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    for p in pages.values():
        title = (p.get("title") or "").lower()
        if "logo" in title or "svg" in title:
            continue
        info = (p.get("imageinfo") or [{}])[0]
        url = info.get("url") or ""
        if url:
            return url.split("?")[0]
    return ""


def commons_file(filename: str) -> str:
    data = get_json(
        "https://commons.wikimedia.org/w/api.php?action=query&titles="
        + urllib.parse.quote(filename)
        + "&prop=imageinfo&iiprop=url&format=json",
        {"User-Agent": UA_WIKI},
    )
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    for p in pages.values():
        info = (p.get("imageinfo") or [{}])[0]
        url = info.get("url") or ""
        if url:
            return url.split("?")[0]
    return ""


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA_WIKI, "Accept": "image/*,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read()
        if len(data) < 800:
            return False
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def aplicar(prod: dict, url: str) -> bool:
    if not url:
        return False
    dest = DEST / f"{prod['id']}.jpg"
    public = PUBLIC / f"{prod['id']}.jpg"
    if dest.exists() and dest.stat().st_size > 800:
        ok = True
    else:
        ok = download(url, dest)
    if not ok:
        prod["imagen"] = url
        return True
    public.write_bytes(dest.read_bytes())
    prod["imagen"] = f"/recursos/imagenes-productos/{prod['id']}.jpg"
    return True


def main() -> None:
    productos = json.loads(PRODUCTOS.read_text(encoding="utf-8"))
    miss = [
        p
        for p in productos
        if not (
            str(p["imagen"]).startswith("/recursos/imagenes-productos/")
            or str(p["imagen"]).startswith("http")
        )
    ]
    print("faltan", len(miss))
    vape_url = (
        commons_file("File:Elf Bar Vape.webp")
        or commons_file("File:Pair_of_Elfbar_e-cigs.png")
        or wiki_original("Elf_Bar")
        or commons_search("Elf Bar vape")
    )
    print("vape base", vape_url)

    ok = 0
    for p in miss:
        nombre = p["nombre"]
        if nombre.strip().lower() in SKIP:
            continue
        seccion = p["seccion"]
        url = ""
        if seccion == "CIGARRILLOS":
            toks = tokens(nombre)
            for t in toks:
                if t in CIG_WIKI:
                    url = wiki_original(CIG_WIKI[t]) or commons_search(f"{t} cigarette pack")
                    if url:
                        break
            if not url:
                url = commons_search("cigarette pack")
        elif seccion == "VAPERS":
            url = vape_url
        else:
            url = buscar_super(nombre)
        if aplicar(p, url):
            ok += 1
            print("OK", p["nombre"][:60])
        else:
            print("NO", p["nombre"][:60])

    PRODUCTOS.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
    propias = sum(
        1
        for x in productos
        if str(x["imagen"]).startswith("/recursos/imagenes-productos/")
        or str(x["imagen"]).startswith("http")
    )
    print(f"Segundo pase +{ok}. Total con foto: {propias}/{len(productos)}")


if __name__ == "__main__":
    main()
