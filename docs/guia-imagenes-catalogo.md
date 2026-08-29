# Guía: fotos de catálogo (reutilizable)

Esta es la receta que usamos en La Triple L para llenar un catálogo argentino con fotos de producto. Sirve para otro minimarket, kiosco o almacén si tenés **nombre + precio** y, idealmente, **código de barras (EAN)**.

## Qué buscar (en este orden)

1. **Packshot de supermercado (VTEX)** — foto de estudio, fondo blanco. Es la que se ve en Jumbo, Disco, Vea, Carrefour y Día.
2. **Open Food Facts / Open Beauty Facts / Open Products Facts** — si el EAN está cargado (sobre todo alimentos importados o marcas grandes).
3. **Búsqueda por nombre** en esos mismos supermercados, con coincidencia de marca.
4. **Foto de rubro** (almacén, bebidas, limpieza…) solo como último recurso.
5. **Wikimedia / Wikipedia** — para cigarrillos y vapers, que casi no están en supermercados online.

No uses fotos de góndola sacadas con el celular ni el primer resultado genérico de un buscador de imágenes: suelen ser el producto equivocado, con reflejos o recorte feo.

## APIs de supermercado (Argentina)

Casi todos corren **VTEX**. Consulta por EAN:

```
GET {tienda}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:{ean}
```

Tiendas que respondieron bien:

| Tienda     | Base URL                                      |
| ---------- | --------------------------------------------- |
| Jumbo      | `https://www.jumbo.com.ar`                    |
| Disco      | `https://www.disco.com.ar`                    |
| Vea        | `https://www.vea.com.ar`                      |
| Carrefour  | `https://www.carrefour.com.ar`                |
| Día        | `https://diaonline.supermercadosdia.com.ar`   |
| Farmacity  | `https://www.farmacity.com` (higiene)         |

La URL de la foto sale de:

`payload[0].items[0].images[0].imageUrl`

Sacale el query `?v=...` si querés un archivo estable. **Descargala a disco** (`recursos/imagenes-productos/{id}.jpg`) en vez de hotlinkear: los CDN de VTEX cambian de id y a veces bloquean.

Búsqueda por nombre:

```
GET {tienda}/api/catalog_system/pub/products/search/{query}
```

No te quedes con el primer hit. Pedí que el **primer token de marca** (Coca, Cepita, Arcor…) aparezca en `productName`. Si buscás “Coca Cola 500” y te trae Cherry Zero o una foto de góndola, descartala.

EAN cortos (8 dígitos): probá el original y `zfill(13)`.

Headers útiles:

```
User-Agent: Mozilla/5.0 …
Accept: application/json
Accept-Language: es-AR,es;q=0.9
```

## Open Food Facts

```
GET https://world.openfoodfacts.org/api/v2/product/{ean}.json?fields=image_front_url,image_url,product_name
```

User-Agent identificable (si no, rate-limit). Campos: `image_front_url` o `image_url`.  
Muchas marcas argentinas **no** están, o la foto es de un usuario en la góndola (mala para catálogo). Úsalo como respaldo, no como fuente principal.

Limpieza / no alimentos:

- `https://world.openbeautyfacts.org/api/v2/product/{ean}.json`
- `https://world.openproductsfacts.org/api/v2/product/{ean}.json`

## Scripts de este repo

| Script                         | Para qué                                      |
| ------------------------------ | --------------------------------------------- |
| `scripts/importar-excel.py`    | Excel TPV → `data/productos.json` + EAN       |
| `scripts/fotos-supermercados.py` | EAN/nombre en VTEX y descarga local         |
| `scripts/fotos-faltantes.py`   | Segundo pase (búsqueda laxa + Wikimedia)      |
| `scripts/enriquecer-fotos.py`  | Reintento Open Food Facts                     |

Flujo recomendado en un proyecto nuevo:

1. Exportar listado (código interno, EAN, nombre, precio, rubro).
2. Generar `productos.json` con ids estables (`p{fila}`).
3. Guardar `data/ean-map.json` (`id → ean`).
4. Correr el script de supermercados **por EAN primero**.
5. Revisar a ojo las bebidas y marcas top (Coca, Cepita, cervezas): si la foto no es el pack exacto, forzar EAN de Jumbo/Carrefour y pisar el jpg.
6. `npm run dev` copia `recursos/imagenes-productos/` → `public/recursos/imagenes-productos/` (`scripts/sync-recursos.mjs`).

## Cómo corregir una foto fea

1. Buscá el producto en `data/productos.json` (por `codigo` o nombre).
2. Anotá el `id` (`p284`) y el EAN en `data/ean-map.json`.
3. Pedile a Jumbo/Carrefour ese EAN y descargá el packshot a:
   - `recursos/imagenes-productos/{id}.jpg`
   - `public/recursos/imagenes-productos/{id}.jpg`
4. Si el navegador sigue mostrando la vieja, agregá cache-bust en el JSON:  
   `"imagen": "/recursos/imagenes-productos/p284.jpg?v=packshot"`

Desde el **panel admin** también se puede subir una foto a mano.

## Qué no copiar a otro proyecto

- Fotos de cigarrillos/vapers de Wikimedia son genéricas (misma marca, no el SKU exacto).
- Ítems que no son mercadería (`Envío`, `Préstamo`, `GRAMO`) pueden quedar con foto de rubro.
- Mercado Libre (`api.mercadolibre.com`) suele devolver 403 sin token.

## Criterio visual

Una foto “de catálogo” se ve bien si:

- fondo blanco o muy limpio
- un solo envase, de frente
- se lee la marca y el contenido neto
- no es foto de góndola, meme ni wallpaper
