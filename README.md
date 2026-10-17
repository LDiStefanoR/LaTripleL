# La Triple L — Minimarket

Sitio del minimarket **La Triple L** (Garay 1005, Rosario). Arquitectura copiada de Movipack: catálogo, carrito, descuentos de cliente y panel admin.

## Desarrollo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3005](http://localhost:3005).

## Páginas

- `/` — Inicio (local, horarios, rubros, mapa)
- `/catalogo` — Góndola online (filtros, búsqueda, carrito)
- `/ingresar` y `/registro` — Cuentas de cliente (precio con descuento)
- `/admin` — Precios, descuentos, fotos, Excel/PDF
- `/admin/clientes` — Solicitudes y pedidos

## Admin

El acceso de administrador no se publica en GitHub. Usá la cuenta local y, en producción, las variables de entorno.

## Datos del negocio

- Dirección: Garay 1005, Rosario, Santa Fe
- WhatsApp: +54 9 341 745-8893
- Lun–vie 8–21 · Sáb 9–21 · Dom 10–14

## Catálogo e imágenes

Los productos viven en `data/productos.json`. Las fotos de góndola están en `recursos/imagenes-productos/` (se copian a `public/` al levantar el sitio).

**Guía reutilizable para otro proyecto:** [docs/guia-imagenes-catalogo.md](docs/guia-imagenes-catalogo.md)

## Publicar en internet (Vercel + Turso)

1. Creá una base en [Turso](https://app.turso.tech) y copiá `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
2. En local: cargá esas variables en `.env.local` (junto con `AUTH_SECRET`) y corré `npm run subir-turso` para subir el catálogo, cuentas y pedidos.
3. Importá el repo en [Vercel](https://vercel.com) o desplegá con `npx vercel --prod`.
4. En **Environment Variables** cargá:
   - `AUTH_SECRET` — el mismo que usaste al subir (cifra usuarios, pedidos y cuentas)
   - `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`
   - `NEXT_PUBLIC_SITE_URL` — la URL de Vercel (ej. `https://la-triple-l.vercel.app`)
   - Opcional: `BLOB_READ_WRITE_TOKEN` / `BLOB_STORE_ID` si querés subir fotos nuevas desde admin (el catálogo ya va en el build)
5. Redesplegá. En internet los JSON del negocio viven en Turso (el disco de Vercel se borra).
