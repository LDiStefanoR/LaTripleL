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
