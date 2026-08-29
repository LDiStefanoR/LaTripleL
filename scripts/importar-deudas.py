"""Imputa deudas del PDF 'PagosaCuenta clientes con deuda' a data/cuentas.json."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTOS = ROOT / "data" / "productos.json"
DEST = ROOT / "data" / "cuentas.json"

# (fecha, cliente, telefono, descripcion, total, debe, ultimo_pago|None)
TICKETS = [
    ("2026-08-12", "Luz Mia", "00000", "Pastillitas Lucky 8 (bolsita x 50gr)", 700, 700, None),
    ("2026-08-13", "Leonardo Rodriguez", "3415402089", "Camel Legend X 20", 4000, 4000, None),
    ("2026-08-13", "Leonardo Rodriguez", "3415402089", "Cepita Durazno Delicioso X 1L", 3300, 1800, "2026-08-21"),
    ("2026-08-14", "Leyla Heredia", "0000000", "Azucar Ledesma Paq x 1 Kg / cafe / Dulce Mama Cocina Madalenas Vainilla x 200gr", 6650, 6650, None),
    ("2026-08-14", "Leyla Heredia", "0000000", "Queso Cremoso x 200gr", 2400, 2400, None),
    ("2026-08-14", "Leyla Heredia", "0000000", "cafe", 3000, 3000, None),
    ("2026-08-14", "Leyla Heredia", "0000000", "Twistos Minitostaditas 4Quesos x 95gr", 4000, 4000, None),
    ("2026-08-14", "Leonardo Rodriguez", "3415402089", "GRAMO / Queso Cremoso x 200gr / Camel Legend X 20", 21400, 200, "2026-08-16"),
    ("2026-08-15", "Leonardo Rodriguez", "3415402089", "Fantoche Minialfajor blanco x 150gr (6u)", 3500, 3500, None),
    ("2026-08-16", "Leonardo Rodriguez", "3415402089", "Soda Sierra De Los Padres Limonada x 1.5L", 2000, 2000, None),
    ("2026-08-18", "Leonardo Rodriguez", "3415402089", "GRAMO", 10800, 10800, None),
    ("2026-08-18", "Leonardo Rodriguez", "3415402089", "Papelillo Premier", 1100, 1100, None),
    ("2026-08-19", "Leyla Heredia", "0000000", "cafe / Alfajor Tatin Simple Blanco", 2100, 2100, None),
    ("2026-08-19", "Leonardo Rodriguez", "3415402089", "Baggio Fresh Saborizada Pomelo x 600CC", 1400, 1400, None),
    ("2026-08-19", "Leyla Heredia", "0000000", "Candy Port Ojos Locos Fake (frasco) x 10gr", 1200, 1200, None),
    ("2026-08-20", "Bruno David Diaz", "000", "Cepita anana hf 1LT / Kinder Barra Max x 21gr", 5300, 5000, "2026-08-22"),
    ("2026-08-20", "Bruno David Diaz", "000", "Doritos Dinamita Fh x 82gr", 3100, 3100, None),
    ("2026-08-20", "Leyla Heredia", "0000000", "cafe / Arcor Formis Cianos Chocol/DDL x 102gr", 2800, 2800, None),
    ("2026-08-20", "Leyla Heredia", "0000000", "Crema La Cabaña x200 / Salchicha Viena Paladini x6u", 4700, 4700, None),
    ("2026-08-21", "Leyla Heredia", "0000000", "cafe / Fachitas Minicoronitas Chocolate X 140gr", 2900, 2900, None),
    ("2026-08-21", "Leyla Heredia", "0000000", "Twistos queso x 40gr", 2200, 2200, None),
    ("2026-08-21", "Judith Adriana Lefelman", "000", "Prestamo dinero efectivo $1.000", 1400000, 1220000, "2026-08-22"),
    ("2026-08-21", "Leonardo Rodriguez", "3415402089", "Lucky Strike Origen Convertible x 20", 4000, 4000, None),
    ("2026-08-22", "Leyla Heredia", "0000000", "Postre Ilolay Kids Vainilla x 120gr / Celosas Bañadas x 230gr / cafe", 4500, 4500, None),
    ("2026-08-22", "Judith Adriana Lefelman", "000", "Prestamo dinero efectivo $1.000", 398000, 198000, "2026-08-24"),
    ("2026-08-22", "Leonardo Rodriguez", "3415402089", "GRAMO", 39000, 39000, None),
    ("2026-08-22", "Leyla Heredia", "0000000", "Arcor Saladix Calabresa x 40gr", 800, 800, None),
    ("2026-08-22", "Leyla Heredia", "0000000", "Always Toallas Extra Proteccion Suave x8u / Agua Lavandina Ayudin 1Lt", 3700, 3700, None),
    ("2026-08-22", "Leonardo Rodriguez", "3415402089", "Crema La Cabaña x200 / Salchicha Viena Fela x6u / Queso Cremoso x 200gr / Leche La Serenisima Descremada Sachet / Tang Pomelo Rosado x 15gr / Tang Durazno x 15gr / Tang Manzana x 15gr / Tang Naranaja Banana x 15gr / Terrabusi Fideos Coditos x 500gr", 12150, 12150, None),
    ("2026-08-23", "Eugenia Gambino", "000", "GRAMO", 15000, 15000, None),
    ("2026-08-23", "Leonardo Rodriguez", "3415402089", "Lucky Strike Origen Convertible x 20 / GRAMO", 16200, 16200, None),
    ("2026-08-23", "Luz Mia", "00000", "Kinder Sorpresa (huevo) nena / Bluper Chicle Metro Rollo Loco Tutti Frutti / Candy Port Ojos Locos Fake (frasco) x 10gr", 7400, 7400, None),
    ("2026-08-24", "Leonardo Rodriguez", "3415402089", "Lucky Strike Origen Convertible x 20", 4000, 4000, None),
    ("2026-08-24", "Leyla Heredia", "0000000", "Alfajor Goat x 75gr / cafe", 3600, 3600, None),
    ("2026-08-24", "Leonardo Rodriguez", "3415402089", "GRAMO", 15000, 15000, None),
    ("2026-08-24", "Leonardo Rodriguez", "3415402089", "Ketchup Natura x 250gr", 2000, 2000, None),
    ("2026-08-24", "Judith Adriana Lefelman", "000", "Teclado ultra slim / Envio a domicilio", 18500, 18500, None),
    ("2026-08-24", "Cristian GN", "000", "parlante JBL go pro", 35000, 5000, "2026-08-25"),
    ("2026-08-24", "Leonardo Rodriguez", "3415402089", "Salchicha Viena Fela x6u / Fetas queso Danbo Cremac x 180gr / Fdo J.Cocido x 200gr / Pan Pancho Don Yeyo / Doritos x 7gr / Cepita HF Naranja Tentacion 1LT", 19700, 19700, None),
    ("2026-08-25", "Leonardo Rodriguez", "3415402089", "Leche La Serenisima Descremada Sachet / Postre Ilolay Kids Vainilla C/DDL x 120gr / Postre Ilolay Kids Vainilla x 120gr / Ralladito Ilolay x40gr / Alfajor Goat x 75gr", 8900, 8900, None),
    ("2026-08-25", "Leyla Heredia", "0000000", "Vaper Elfbar GH 23.000 PUFF Grape Ice / Gillette Prestobarba", 28400, 28400, None),
    ("2026-08-25", "Leyla Heredia", "0000000", "Fachitas Minicoronitas Chocolate X 140gr / cafe", 2900, 2900, None),
    ("2026-08-25", "Cristian GN", "000", "Envio a domicilio", 5000, 5000, None),
    ("2026-08-25", "Gaso Nor", "3415989500", "Corrector Util Uno x 7ml", 1300, 1300, None),
    ("2026-08-25", "Leyla Heredia", "0000000", "Conitos C/DDL y Choc", 400, 400, None),
    ("2026-08-25", "Bruno David Diaz", "000", "Monster Reser Pineap x 473ml / Candy Port Ojos Locos Fake (frasco) x 10gr / Fel-Fort Piratas X 5gr / Arcor Cofler Tab Yogurt Frutilla x 64gr", 9300, 9300, None),
    ("2026-08-25", "Leonardo Rodriguez", "3415402089", "Baggio Fresh Saborizada manzana x 600CC", 1400, 1400, None),
    ("2026-08-25", "Bruno David Diaz", "000", "Landy Mani SAborizado Queso (pote) X 120gr", 2300, 2300, None),
    ("2026-08-25", "Leonardo Rodriguez", "3415402089", "cafe", 4500, 4500, None),
    ("2026-08-25", "Bruno David Diaz", "000", "Cargadores Pared Only 4.8A 1 USB Solo Cabezal Modo-018Rush / Tira Led Neon Audiodinamica 5Metros Control y App Rgb-ic Configurable", 54300, 54300, None),
    ("2026-08-25", "Leonardo Rodriguez", "3415402089", "Queso Cremoso x 200gr / Morixe Atun Desmenuzado Natural 170gr uni / Sal Fina Celusal Caja x500gr / GRAMO", 21300, 21300, None),
]


def slug(nombre: str) -> str:
    s = unicodedata.normalize("NFD", nombre.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^a-z0-9]+", ".", s).strip(".")
    return s


def es_efectivo(desc: str) -> bool:
    d = desc.lower()
    return "prestamo" in d or "préstamo" in d or "efectivo" in d


def normalizar(txt: str) -> str:
    s = unicodedata.normalize("NFD", txt.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def tokens(txt: str) -> set[str]:
    stop = {"x", "gr", "g", "ml", "l", "lt", "u", "un", "de", "con", "la", "el"}
    return {t for t in normalizar(txt).split() if t not in stop and len(t) > 2}


def match_codigo(item: str, productos: list[dict]) -> str:
    nt = tokens(item)
    if not nt:
        return ""
    mejor = ("", 0)
    for p in productos:
        pt = tokens(p["nombre"])
        score = len(nt & pt)
        if score > mejor[1] and score >= 2:
            mejor = (str(p.get("codigo") or ""), score)
    return mejor[0]


def pin_de(tel: str) -> str:
    digits = re.sub(r"\D", "", tel)
    if len(digits) >= 8 and not set(digits) <= {"0"}:
        return digits[-4:]
    return "1234"


def main() -> None:
    productos = json.loads(PRODUCTOS.read_text(encoding="utf-8"))
    clientes: dict[str, dict] = {}
    tickets = []
    for i, (fecha, nombre, tel, desc, total, debe, ult) in enumerate(TICKETS, 1):
        clave = slug(nombre)
        if clave not in clientes:
            clientes[clave] = {
                "id": f"cli-{clave}",
                "nombre": nombre,
                "telefono": tel,
                "email": f"{clave}@cuenta.latriplel.com",
                "pinInicial": pin_de(tel),
                "limiteAlmacen": 50_000,
                "limiteEfectivo": 1_000_000 if clave.startswith("judith") else 0,
                "aliasCbu": "",
                "activo": True,
            }
        tipo = "efectivo" if es_efectivo(desc) else "almacen"
        lineas = []
        for parte in re.split(r"\s*/\s*", desc):
            parte = parte.strip()
            if not parte:
                continue
            lineas.append({"nombre": parte, "codigo": match_codigo(parte, productos)})
        tickets.append(
            {
                "id": f"t{i:03d}",
                "clienteId": clientes[clave]["id"],
                "fecha": fecha,
                "descripcion": desc,
                "tipo": tipo,
                "total": total,
                "debe": debe,
                "ultimoPago": ult,
                "estado": "vigente" if debe > 0 else "pagada",
                "origen": "pdf-26-8",
                "lineas": lineas,
            }
        )

    pagos = []
    n = 1
    for t in tickets:
        cobrado = t["total"] - t["debe"]
        if cobrado > 0:
            pagos.append(
                {
                    "id": f"pg{n:03d}",
                    "clienteId": t["clienteId"],
                    "ticketId": t["id"],
                    "monto": cobrado,
                    "tipo": "parcial",
                    "medio": "importado",
                    "nota": f"Saldo informado en el listado al {t['ultimoPago'] or t['fecha']}",
                    "comprobante": "",
                    "creadoEn": (t["ultimoPago"] or t["fecha"]) + "T12:00:00.000Z",
                    "estado": "confirmado",
                }
            )
            n += 1

    data = {
        "ajustes": {
            "alias": "",
            "cbu": "",
            "titular": "La Triple L",
            "banco": "",
            "limiteAlmacenDefault": 50000,
            "limiteEfectivoDefault": 0,
            "plazoEfectivoHoras": 48,
            "importadoEn": "2026-08-26",
            "archivoOrigen": "PagosaCuenta clientes con deuda 26-8.pdf",
        },
        "clientes": list(clientes.values()),
        "tickets": tickets,
        "pagos": pagos,
        "solicitudes": [],
        "novedades": [],
    }
    if DEST.exists():
        actual = json.loads(DEST.read_text(encoding="utf-8"))
        prev_ajustes = actual.get("ajustes") or {}
        for clave in ("alias", "cbu", "titular", "banco"):
            if prev_ajustes.get(clave):
                data["ajustes"][clave] = prev_ajustes[clave]
        prev_clientes = {c["id"]: c for c in actual.get("clientes") or []}
        for c in data["clientes"]:
            viejo = prev_clientes.get(c["id"])
            if not viejo:
                continue
            c["limiteAlmacen"] = viejo.get("limiteAlmacen", c["limiteAlmacen"])
            c["limiteEfectivo"] = viejo.get("limiteEfectivo", c["limiteEfectivo"])
            c["aliasCbu"] = viejo.get("aliasCbu") or c["aliasCbu"]
            if viejo.get("pinInicial"):
                c["pinInicial"] = viejo["pinInicial"]
        existentes = {
            (t.get("fecha"), t.get("clienteId"), t.get("descripcion"), t.get("total"))
            for t in actual.get("tickets") or []
        }
        nuevos = [
            t
            for t in tickets
            if (t["fecha"], t["clienteId"], t["descripcion"], t["total"]) not in existentes
        ]
        data["tickets"] = (actual.get("tickets") or []) + nuevos
        data["pagos"] = actual.get("pagos") or pagos
        data["solicitudes"] = actual.get("solicitudes") or []
        data["novedades"] = actual.get("novedades") or []
        vistos = {c["id"] for c in data["clientes"]}
        for c in actual.get("clientes") or []:
            if c.get("id") not in vistos:
                data["clientes"].append(c)
        print(f"Merge: +{len(nuevos)} tickets nuevos, se conservan pagos y límites")
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    debe = sum(t["debe"] for t in data["tickets"] if t.get("estado") != "pagada")
    print(f"Clientes {len(data['clientes'])} tickets {len(data['tickets'])} debe {debe} pagos {len(data['pagos'])}")


if __name__ == "__main__":
    main()
