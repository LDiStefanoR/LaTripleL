# -*- coding: utf-8 -*-
"""Asigna a cada producto una foto de stock acorde a su nombre y la descarga."""
from __future__ import annotations

import json
import ssl
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "productos.json"
IMG_DIR = ROOT / "recursos" / "imagenes-productos"

# slug -> urls de respaldo (Pexels / Unsplash / Wikimedia)
IMAGES: dict[str, list[str]] = {
    "bolsa-cierre": [
        "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-kraft": [
        "https://images.pexels.com/photos/1666067/pexels-photo-1666067.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/5625120/pexels-photo-5625120.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-kraft-asa": [
        "https://images.pexels.com/photos/5625120/pexels-photo-5625120.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1666065/pexels-photo-1666065.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-panaderia": [
        "https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-ecommerce": [
        "https://images.pexels.com/photos/6169668/pexels-photo-6169668.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4391470/pexels-photo-4391470.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-friselina": [
        "https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/5632397/pexels-photo-5632397.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-rinon": [
        "https://images.pexels.com/photos/5625118/pexels-photo-5625118.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1666067/pexels-photo-1666067.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-cristal": [
        "https://images.pexels.com/photos/3735218/pexels-photo-3735218.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4239013/pexels-photo-4239013.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-camiseta": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Plastic_bag.jpg/640px-Plastic_bag.jpg",
        "https://images.pexels.com/photos/3735216/pexels-photo-3735216.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-delivery": [
        "https://images.pexels.com/photos/4393426/pexels-photo-4393426.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4391470/pexels-photo-4391470.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bolsa-residuos": [
        "https://images.pexels.com/photos/802221/pexels-photo-802221.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-pizza": [
        "https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1566837/pexels-photo-1566837.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-hamburguesa": [
        "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-delivery": [
        "https://images.pexels.com/photos/4393426/pexels-photo-4393426.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-regalo": [
        "https://images.pexels.com/photos/264787/pexels-photo-264787.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1303088/pexels-photo-1303088.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-desayuno": [
        "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-cupcake": [
        "https://images.pexels.com/photos/913136/pexels-photo-913136.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1028714/pexels-photo-1028714.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-torta": [
        "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "caja-corazon": [
        "https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/264787/pexels-photo-264787.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "globos": [
        "https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "globos-neon": [
        "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cotillon-lentes": [
        "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cotillon-antifaz": [
        "https://images.pexels.com/photos/2072181/pexels-photo-2072181.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cotillon-luz": [
        "https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cotillon-confeti": [
        "https://images.pexels.com/photos/1303081/pexels-photo-1303081.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cotillon-ninos": [
        "https://images.pexels.com/photos/1729931/pexels-photo-1729931.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/2072181/pexels-photo-2072181.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "vaso-plastico": [
        "https://images.pexels.com/photos/1283219/pexels-photo-1283219.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "vaso-trago": [
        "https://images.pexels.com/photos/338713/pexels-photo-338713.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1283219/pexels-photo-1283219.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "copa-champagne": [
        "https://images.pexels.com/photos/1407846/pexels-photo-1407846.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "vaso-termico": [
        "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "film-pvc": [
        "https://images.pexels.com/photos/4259140/pexels-photo-4259140.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4099238/pexels-photo-4099238.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "film-stretch": [
        "https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4484078/pexels-photo-4484078.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "burbuja": [
        "https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cinta-embalaje": [
        "https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4484078/pexels-photo-4484078.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cinta-papel": [
        "https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/159751/book-address-book-learning-learn-159751.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bandeja-expandido": [
        "https://images.pexels.com/photos/616401/pexels-photo-616401.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/2297526/pexels-photo-2297526.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bandeja-aluminio": [
        "https://images.pexels.com/photos/4259140/pexels-photo-4259140.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bandeja-carton": [
        "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bandeja-pet": [
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "pote": [
        "https://images.pexels.com/photos/3735149/pexels-photo-3735149.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3735218/pexels-photo-3735218.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "marmita": [
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "guantes-nitrilo": [
        "https://images.pexels.com/photos/3985163/pexels-photo-3985163.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "guantes-latex": [
        "https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3985163/pexels-photo-3985163.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "papel-higienico": [
        "https://images.pexels.com/photos/3951901/pexels-photo-3951901.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3951922/pexels-photo-3951922.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "rollo-cocina": [
        "https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3951901/pexels-photo-3951901.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "panuelos": [
        "https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/3951901/pexels-photo-3951901.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bobina-limpieza": [
        "https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "moños": [
        "https://images.pexels.com/photos/264787/pexels-photo-264787.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1303088/pexels-photo-1303088.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "palitos-helado": [
        "https://images.pexels.com/photos/1352281/pexels-photo-1352281.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/162523/ice-cream-ice-cream-cone-ice-cream-ball-162523.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "sobre-manila": [
        "https://images.pexels.com/photos/821738/pexels-photo-821738.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/159751/book-address-book-learning-learn-159751.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "birome": [
        "https://images.pexels.com/photos/261763/pexels-photo-261763.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/159751/book-address-book-learning-learn-159751.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "silicona": [
        "https://images.pexels.com/photos/1094770/pexels-photo-1094770.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "abrochadora": [
        "https://images.pexels.com/photos/159751/book-address-book-learning-learn-159751.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "adhesivo": [
        "https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "elastico": [
        "https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "dulce-leche": [
        "https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "molde-torta": [
        "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "pirotin": [
        "https://images.pexels.com/photos/913136/pexels-photo-913136.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1055272/pexels-photo-1055272.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "colorante": [
        "https://images.pexels.com/photos/1070850/pexels-photo-1070850.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "sprinkles": [
        "https://images.pexels.com/photos/1055272/pexels-photo-1055272.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/913136/pexels-photo-913136.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "velas": [
        "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "blonda": [
        "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "pasta-torta": [
        "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "alfajor": [
        "https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "papel-manteca": [
        "https://images.pexels.com/photos/4259140/pexels-photo-4259140.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "aluminio": [
        "https://images.pexels.com/photos/4099238/pexels-photo-4099238.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4259140/pexels-photo-4259140.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "papel-sulfito": [
        "https://images.pexels.com/photos/821738/pexels-photo-821738.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "vacio": [
        "https://images.pexels.com/photos/4099238/pexels-photo-4099238.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "corrugado": [
        "https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "platos": [
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "cubiertos": [
        "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "hilo": [
        "https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "filtro-freidora": [
        "https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "sobre-hamburguesa": [
        "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "etiqueta": [
        "https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/821738/pexels-photo-821738.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "bandera": [
        "https://images.pexels.com/photos/1303081/pexels-photo-1303081.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
    "default": [
        "https://images.pexels.com/photos/4391470/pexels-photo-4391470.jpeg?auto=compress&cs=tinysrgb&w=900",
        "https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=900",
    ],
}

SECTION_DEFAULT = {
    "BOLSAS": "bolsa-cristal",
    "CAJAS MICRO": "caja-delivery",
    "CAJAS Y ESTUCHES": "caja-regalo",
    "COTILLON": "cotillon-confeti",
    "DESCARTABLES": "vaso-plastico",
    "EMBALAJE": "cinta-embalaje",
    "EXPANDIDO": "bandeja-expandido",
    "HIGIENE": "papel-higienico",
    "LIBRERIA": "birome",
    "PERSONALIZADOS": "bolsa-friselina",
    "POTES": "pote",
    "REPOSTERIA": "molde-torta",
    "ROLLOS": "papel-manteca",
    "TERMICOS": "vaso-termico",
    "VARIOS": "bandeja-carton",
}

RULES: list[tuple[list[str], str]] = [
    (["zipper", "cierre zipper"], "bolsa-cierre"),
    (["e-commerce", "ecommerce", "e commerce"], "bolsa-ecommerce"),
    (["friselina"], "bolsa-friselina"),
    (["panaderia", "panadería"], "bolsa-panaderia"),
    (["camiseta"], "bolsa-camiseta"),
    (["riñon", "rinon", "riño", "rino"], "bolsa-rinon"),
    (["pizza"], "caja-pizza"),
    (["hamburg", "hambur"], "caja-hamburguesa"),
    (["torpedo", "raviole", "caja micro"], "caja-delivery"),
    (["cupcake"], "caja-cupcake"),
    (["drip cake", "maletin", "maletín"], "caja-torta"),
    (["desayuno", "bastones"], "caja-desayuno"),
    (["corazon", "corazón"], "caja-corazon"),
    (["box", "estuche", "bombonera", "perfume", "libro", "cajita feliz"], "caja-regalo"),
    (["neon", "fluor", "fluores"], "globos-neon"),
    (["globo"], "globos"),
    (["lente", "anteojo"], "cotillon-lentes"),
    (["antifaz", "mascara", "máscara"], "cotillon-antifaz"),
    (["luz", "led", "vincha"], "cotillon-luz"),
    (["baby", "mickey", "infantil", "souvenir"], "cotillon-ninos"),
    (["shimmer", "confeti", "cotillon"], "cotillon-confeti"),
    (["champagne", "champan", "champán"], "copa-champagne"),
    (["trago"], "vaso-trago"),
    (["termico", "térmico", "estisol"], "vaso-termico"),
    (["vaso"], "vaso-plastico"),
    (["film pvc", "film aliment", "film familiar"], "film-pvc"),
    (["stretch", "strech"], "film-stretch"),
    (["burbuja"], "burbuja"),
    (["cinta adhes", "cinta trans", "cinta blanca", "fragil", "frágil", "dispenser cinta", "doble faz"], "cinta-embalaje"),
    (["cinta de papel", "cinta papel"], "cinta-papel"),
    (["expandido", "oblea"], "bandeja-expandido"),
    (["rollo de aluminio", "rollo aluminio", "aluminio familiar"], "aluminio"),
    (["aluminio", "alpac"], "bandeja-aluminio"),
    (["bandeja pet", "bandeja ps", "bandeja micro"], "bandeja-pet"),
    (["bandeja carton", "bandeja cartón", "bandeja eco"], "bandeja-carton"),
    (["bandeja"], "bandeja-carton"),
    (["pote"], "pote"),
    (["marmita"], "marmita"),
    (["nitrilo"], "guantes-nitrilo"),
    (["latex", "látex"], "guantes-latex"),
    (["higenico", "higienico", "higiénico"], "papel-higienico"),
    (["cocina", "maxirollo"], "rollo-cocina"),
    (["pañuelo", "panuelo", "snif"], "panuelos"),
    (["bobina"], "bobina-limpieza"),
    (["residuo", "consorcio", "concorcio"], "bolsa-residuos"),
    (["moño", "moño"], "moños"),
    (["palito"], "palitos-helado"),
    (["manila"], "sobre-manila"),
    (["birome", "boligrafo", "bolígrafo"], "birome"),
    (["silicona"], "silicona"),
    (["abroch"], "abrochadora"),
    (["adhesivo"], "adhesivo"),
    (["elastica", "elástica", "flexiband"], "elastico"),
    (["dulce de leche"], "dulce-leche"),
    (["molde", "bizcochuelo", "rosca"], "molde-torta"),
    (["pirotin", "pirotín"], "pirotin"),
    (["colorante"], "colorante"),
    (["perla", "grana"], "sprinkles"),
    (["vela"], "velas"),
    (["blonda"], "blonda"),
    (["pasta p cubrir", "pasta para cub"], "pasta-torta"),
    (["alfajor"], "alfajor"),
    (["manteca"], "papel-manteca"),
    (["sulfito"], "papel-sulfito"),
    (["vacio", "vacío"], "vacio"),
    (["corrugado"], "corrugado"),
    (["plato"], "platos"),
    (["cubierto", "tenedor", "cuchillo", "cuchar"], "cubiertos"),
    (["hilo"], "hilo"),
    (["filtro", "freidora"], "filtro-freidora"),
    (["hamburgues", "papas"], "sobre-hamburguesa"),
    (["etiqueta"], "etiqueta"),
    (["bandera"], "bandera"),
    (["kraft"], "bolsa-kraft"),
    (["cristal", "polipropileno", "arranque", "cierre"], "bolsa-cristal"),
    (["manija", "delivery"], "bolsa-delivery"),
    (["film"], "film-pvc"),
    (["cinta"], "cinta-embalaje"),
]


def norm(text: str) -> str:
    return (
        text.lower()
        .replace("ñ", "n")
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )


def image_key(nombre: str, seccion: str) -> str:
    n = norm(nombre)
    if "kraft" in n and any(x in n for x in ("manija", "asa", "c/manija")):
        return "bolsa-kraft-asa"
    for keys, slug in RULES:
        if any(k in n for k in keys):
            return slug
    return SECTION_DEFAULT.get(seccion, "default")


def download(urls: list[str], dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 4000:
        return True
    ctx = ssl.create_default_context()
    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 MarvePackCatalog/1.0"},
            )
            with urllib.request.urlopen(req, context=ctx, timeout=40) as res:
                data = res.read()
            if len(data) < 3000:
                continue
            dest.write_bytes(data)
            print("ok", dest.name, dest.stat().st_size)
            return True
        except Exception as exc:
            print("fail", dest.stem, exc)
    return False


def main() -> None:
    products = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    counts: Counter[str] = Counter()
    needed: set[str] = set()
    for item in products:
        slug = image_key(item["nombre"], item["seccion"])
        item["imagen"] = f"/recursos/imagenes-productos/{slug}.jpg"
        counts[slug] += 1
        needed.add(slug)

    JSON_PATH.write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("productos", len(products), "tipos de foto", len(needed))
    for slug, n in counts.most_common():
        print(f"  {n:3d}  {slug}")

    missing: list[str] = []
    for slug in sorted(needed):
        urls = IMAGES.get(slug) or IMAGES["default"]
        if not download(urls, IMG_DIR / f"{slug}.jpg"):
            missing.append(slug)
            download(IMAGES["default"], IMG_DIR / f"{slug}.jpg")
    if missing:
        print("FALLARON (usaron default):", missing)


if __name__ == "__main__":
    main()
