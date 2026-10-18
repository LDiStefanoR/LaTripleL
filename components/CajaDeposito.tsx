"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  crearRubro,
  eliminarRubro,
  guardarCatalogoWeb,
  guardarEnvioAdmin,
  guardarPreciosAdmin,
  renombrarRubro,
  subirImagenRubro,
  type EstadoAdmin,
} from "@/app/acciones/admin";
import {
  cargarClienteCaja,
  cargarEmpleadoCaja,
  guardarPermisosEmpleadoCaja,
  actualizarPedidoCaja,
  generarPedidoProveedor,
  recepcionarPedidoCaja,
  guardarMedioPagoCaja,
  guardarProveedorCaja,
  quitarMedioPagoCaja,
  quitarPedidoCaja,
  quitarProveedorCaja,
  actualizarInventarioCaja,
  entrarComprobanteCaja,
  regularizarStockCaja,
  type EstadoDeposito,
} from "@/app/acciones/deposito";
import { guardarDatosLocal, leerDatosLocal } from "@/app/acciones/local";
import { DEMORA_ENTREGA_BASE, type DatosLocal } from "@/lib/datos-local";
import { AdminImagesForm } from "@/components/AdminImagesForm";
import { caja } from "@/components/caja-estilo";
import { ETIQUETA_PERMISO_CAJA, PERMISOS_CAJA, permisosCajaDe } from "@/lib/permisos-caja";
import { RUBRO_RESERVADO } from "@/lib/categorias";
import { CajaClienteForm } from "@/components/CajaClienteForm";
import { CajaFichaCliente } from "@/components/CajaFichaCliente";
import { nombreVisible } from "@/lib/venta-texto";
import { digitosMonto, formatoPesos, nombreVitrina, textoMonto } from "@/lib/format";
import type { EscalaEnvio } from "@/types/ajustes";
import type { MedioPago } from "@/lib/medios-pago";
import type { EntradaStock, PedidoProveedor, Proveedor, RegularizacionStock } from "@/lib/deposito";
import { EntradaMercaderia, InventarioProductos, MenuStock, PedidoProveedorPanel } from "@/components/CajaStock";
import type { ProductoCaja } from "@/components/CajaPanel";
import type { Producto } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

export type PersonaCaja = {
  id: string;
  nombre: string;
  apellido: string;
  codigo: string;
  email: string;
  rol: string;
  telefono: string;
  direccion: string;
  cumpleanos: string;
  documento: string;
  nota: string;
  descuento: number;
  cuentaWeb: boolean;
  limiteAlmacen: number;
  limiteEfectivo: number;
  cuotasMaximas?: 1 | 2 | 3 | 6;
  cuotasHabilitadas?: (1 | 2 | 3 | 6)[];
  interesModo?: "general" | "propio";
  interes1?: number;
  interes2?: number;
  interes3?: number;
  interes6?: number;
  moraModo?: "escala" | "fijo" | "sin";
  moraPorcentaje?: number;
  moraCreditoModo?: "escala" | "fijo" | "sin";
  moraCreditoPorcentaje?: number;
  moraCuentaModo?: "escala" | "fijo" | "sin";
  moraCuentaPorcentaje?: number;
  plazoCuenta?: number;
  permisosCaja?: string[];
};

export type CompraCaja = {
  id: string;
  numero: number;
  creadoEn: string;
  cliente: string;
  clienteId?: string;
  formaPago: string;
  total: number;
  anulada?: boolean;
};

export type DeudaCaja = {
  nombre: string;
  email: string;
  telefono: string;
  debe: number;
  interes: number;
  semanas: number;
  tickets: { numero: string; fecha: string; descripcion: string; debe: number }[];
};

type PantallaStock = "menu" | "pedido" | "regularizar" | "entrada" | "inventario";
type PantallaMant = "menu" | "proveedores" | "clientes" | "empleados" | "productos" | "secciones" | "pagos" | "descuento" | "catalogo" | "envio" | "local";
type ModoDeposito = "stock" | "mantenimiento" | "clientes" | "productos";

const BOTON = caja.botonAlto;
const CAMPO = caja.campo;

export function CajaDeposito({
  modo,
  productos,
  proveedores,
  pedidos,
  regularizaciones,
  entradas,
  personas,
  compras,
  deudas,
  esAdmin,
  etiqueta,
  fichaProductos,
  fichaRubros,
  descuentoClienteGenerico,
  recargoWeb,
  tasasCuota,
  moraCredito,
  moraCuenta,
  plazoCuenta,
  envio,
  ajustePorSeccion,
  mediosPago,
  onSalir,
}: {
  modo: ModoDeposito;
  productos: ProductoCaja[];
  proveedores: Proveedor[];
  pedidos: PedidoProveedor[];
  regularizaciones: RegularizacionStock[];
  entradas: EntradaStock[];
  personas: PersonaCaja[];
  compras: CompraCaja[];
  deudas: DeudaCaja[];
  esAdmin: boolean;
  etiqueta: Record<string, string>;
  fichaProductos: Producto[];
  fichaRubros: Rubro[];
  descuentoClienteGenerico: number;
  recargoWeb: number;
  tasasCuota: { 1: number; 2: number; 3: number; 6: number };
  moraCredito: number[];
  moraCuenta: number[];
  plazoCuenta: number;
  envio: EscalaEnvio;
  ajustePorSeccion: Record<string, number>;
  mediosPago: MedioPago[];
  onSalir: () => void;
}) {
  const router = useRouter();
  const [stock, setStock] = useState<PantallaStock>("menu");
  const [mant, setMant] = useState<PantallaMant>(
    modo === "clientes" ? "clientes" : modo === "productos" ? "productos" : "menu",
  );
  function volverSeccion() {
    if (modo === "clientes" || modo === "productos") onSalir();
    else {
      setMensaje(null);
      setMant("menu");
    }
  }
  const [fichaCliente, setFichaCliente] = useState<string | null>(null);
  const [altaCliente, setAltaCliente] = useState(false);
  const [mensaje, setMensaje] = useState<EstadoDeposito>(null);
  const [pending, start] = useTransition();

  function run(tarea: () => Promise<EstadoDeposito>) {
    setMensaje(null);
    return new Promise<EstadoDeposito>((resolve) => {
      start(async () => {
        const resultado = await tarea();
        setMensaje(resultado);
        if (resultado?.ok) router.refresh();
        resolve(resultado);
      });
    });
  }

  const aviso = (
    <>
      {mensaje?.error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
          {mensaje.error}
        </p>
      )}
      {mensaje?.ok && (
        <p className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
          {mensaje.ok}
        </p>
      )}
    </>
  );

  if (modo === "stock" && stock === "menu") {
    return (
      <MenuStock
        onPedido={() => setStock("pedido")}
        onEntrada={() => setStock("entrada")}
        onRegularizar={() => setStock("regularizar")}
        onInventario={() => setStock("inventario")}
        onSalir={onSalir}
      />
    );
  }

  if (modo === "stock" && stock === "pedido") {
    return (
      <PedidoProveedorPanel
        productos={productos}
        proveedores={proveedores}
        pedidos={pedidos}
        etiqueta={etiqueta}
        rubros={fichaRubros.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta }))}
        pending={pending}
        aviso={aviso}
        onVolver={() => {
          setMensaje(null);
          setStock("menu");
        }}
        onGenerar={(data) => run(() => generarPedidoProveedor(data))}
        onActualizar={(data) => run(() => actualizarPedidoCaja(data))}
        onRecepcion={(data) => run(() => recepcionarPedidoCaja(data))}
        onAviso={(ok) => setMensaje({ ok })}
        onQuitar={(id) => {
          const data = new FormData();
          data.set("id", id);
          run(() => quitarPedidoCaja(data));
        }}
      />
    );
  }

  if (modo === "stock" && stock === "regularizar") {
    return (
      <Regularizar
        productos={productos}
        movimientos={regularizaciones}
        pending={pending}
        aviso={aviso}
        onVolver={() => {
          setMensaje(null);
          setStock("menu");
        }}
        onGuardar={(data) => run(() => regularizarStockCaja(data))}
      />
    );
  }

  if (modo === "stock" && stock === "entrada") {
    return (
      <EntradaMercaderia
        productos={productos}
        entradas={entradas}
        proveedores={proveedores}
        rubros={fichaRubros.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta }))}
        pending={pending}
        aviso={aviso}
        onVolver={() => {
          setMensaje(null);
          setStock("menu");
        }}
        onGuardar={(data) => run(() => entrarComprobanteCaja(data))}
        onAviso={(ok) => setMensaje({ ok })}
      />
    );
  }

  if (modo === "stock" && stock === "inventario") {
    return (
      <InventarioProductos
        productos={productos}
        proveedores={proveedores}
        etiqueta={etiqueta}
        rubros={fichaRubros.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta }))}
        pending={pending}
        aviso={aviso}
        onVolver={() => {
          setMensaje(null);
          setStock("menu");
        }}
        onGuardar={(data) => run(() => actualizarInventarioCaja(data))}
      />
    );
  }

  if (mant === "menu") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="font-display text-3xl font-bold">Mantenimiento</h2>
        {aviso}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {esAdmin && (
            <button type="button" className={BOTON} onClick={() => setMant("empleados")}>
              Empleados
            </button>
          )}
          <button type="button" className={BOTON} onClick={() => setMant("proveedores")}>
            Proveedores
          </button>
          <button type="button" className={BOTON} onClick={() => setMant("secciones")}>
            Secciones
          </button>
          <button type="button" className={BOTON} onClick={() => setMant("pagos")}>
            Medios de pago
          </button>
          <button type="button" className={BOTON} onClick={() => setMant("local")}>
            Datos del local
          </button>
          {esAdmin && (
            <button type="button" className={BOTON} onClick={() => setMant("catalogo")}>
              Catálogo web
            </button>
          )}
          {esAdmin && (
            <button type="button" className={BOTON} onClick={() => setMant("descuento")}>
              Intereses créditos y cuentas corrientes
            </button>
          )}
          {esAdmin && (
            <button type="button" className={BOTON} onClick={() => setMant("envio")}>
              Envío a domicilio
            </button>
          )}
        </div>
        <button type="button" className={`${BOTON} mt-8`} onClick={onSalir}>
          Salir
        </button>
      </section>
    );
  }

  if (mant === "envio") {
    return <EnvioDomicilio escala={envio} onVolver={() => setMant("menu")} />;
  }

  if (mant === "catalogo") {
    return (
      <CatalogoWeb
        recargo={recargoWeb}
        descuento={Math.max(0, descuentoClienteGenerico)}
        onVolver={() => setMant("menu")}
      />
    );
  }

  if (mant === "descuento") {
    return (
      <DescuentoClientes
        tasasCuota={tasasCuota}
        moraCredito={moraCredito}
        moraCuenta={moraCuenta}
        plazoCuenta={plazoCuenta}
        onVolver={() => setMant("menu")}
      />
    );
  }

  if (mant === "secciones") {
    return <Secciones rubros={fichaRubros} productos={fichaProductos} onVolver={() => setMant("menu")} />;
  }

  if (mant === "local") {
    return <DatosDelLocal onVolver={() => setMant("menu")} />;
  }

  if (mant === "pagos") {
    return (
      <MediosPago
        medios={mediosPago}
        pending={pending}
        aviso={aviso}
        onVolver={() => {
          setMensaje(null);
          setMant("menu");
        }}
        onGuardar={(data) => run(() => guardarMedioPagoCaja(data))}
        onQuitar={(data) => run(() => quitarMedioPagoCaja(data))}
      />
    );
  }

  if (mant === "productos") {
    return (
      <div className="px-3 py-4">
        <AdminImagesForm
          productos={fichaProductos}
          rubros={fichaRubros}
          proveedores={proveedores}
          descuentoClienteGenerico={descuentoClienteGenerico}
          ajustePorSeccion={ajustePorSeccion}
          onSalir={volverSeccion}
        />
      </div>
    );
  }

  if (mant === "proveedores") {
    return (
      <FichaSimple
        titulo="Proveedores"
        aviso={aviso}
        pending={pending}
        onVolver={() => {
          setMensaje(null);
          setMant("menu");
        }}
        onGuardar={(data) => run(() => guardarProveedorCaja(data))}
        campos={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "telefono", label: "Teléfono" },
          { name: "nota", label: "Nota" },
        ]}
        filas={proveedores.map((p) => ({
          id: p.id,
          titulo: p.nombre,
          detalle: [p.telefono, p.nota].filter(Boolean).join(" · "),
        }))}
        onQuitar={(id) => {
          const data = new FormData();
          data.set("id", id);
          run(() => quitarProveedorCaja(data));
        }}
      />
    );
  }

  if (mant === "clientes") {
    const clientes = personas.filter((p) => p.rol === "cliente");
    const abierta = clientes.find((p) => p.id === fichaCliente) ?? null;
    if (abierta) {
      const deuda = deudas.find((d) => d.email.trim().toLowerCase() === abierta.email.trim().toLowerCase()) ?? null;
      return (
        <CajaFichaCliente
          persona={abierta}
          compras={compras}
          deuda={deuda}
          tasasCuota={tasasCuota}
          moraCredito={moraCredito}
          moraCuenta={moraCuenta}
          plazoGeneral={plazoCuenta}
          onVolver={() => setFichaCliente(null)}
        />
      );
    }
    if (altaCliente) {
      return (
        <div className="mx-auto max-w-xl px-3 py-4">
          {aviso}
          <CajaClienteForm
            pending={pending}
            tasasCuota={tasasCuota}
            moraCredito={moraCredito}
            moraCuenta={moraCuenta}
            plazoGeneral={plazoCuenta}
            aviso={mensaje?.error ?? ""}
            onCancelar={() => {
              setMensaje(null);
              setAltaCliente(false);
            }}
            onCrear={(data) =>
              run(async () => {
                const r = await cargarClienteCaja(data);
                if (r?.ok) setAltaCliente(false);
                return r;
              })
            }
          />
        </div>
      );
    }
    return (
      <section className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="font-display text-3xl font-bold">Clientes</h2>
        {aviso}
        <button type="button" className={`${BOTON} mt-4`} onClick={() => setAltaCliente(true)}>
          Nuevo cliente
        </button>
        <ul className="mt-4 overflow-hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {clientes.map((p) => (
            <li key={p.id} className="border-b border-neutral-200 last:border-0">
              <button
                type="button"
                className="flex w-full items-baseline justify-between px-3 py-2 text-left hover:bg-movipack/5"
                onClick={() => setFichaCliente(p.id)}
              >
                <span>
                  <span className="block font-black">{nombreVisible(p)}</span>
                  <span className="text-xs text-neutral-600">
                    {[p.codigo && `Cód. ${p.codigo}`, p.telefono, p.documento].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs font-bold">Ficha</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${BOTON} mt-4`}
          onClick={volverSeccion}
        >
          Salir
        </button>
      </section>
    );
  }

  return (
    <EmpleadosCaja
      personas={personas.filter((p) => p.rol === "caja" || p.rol === "admin")}
      aviso={aviso}
      pending={pending}
      onVolver={() => {
        setMensaje(null);
        setMant("menu");
      }}
      onCrear={(data) => run(() => cargarEmpleadoCaja(data))}
      onPermisos={(data) => run(() => guardarPermisosEmpleadoCaja(data))}
    />
  );
}

function PermisosMenu({ elegidos }: { elegidos: string[] }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-1 text-sm font-black">Puede entrar a</legend>
      {PERMISOS_CAJA.map((permiso) => (
        <label key={permiso} className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            name={`permiso_${permiso}`}
            value="1"
            defaultChecked={elegidos.includes(permiso)}
          />
          {ETIQUETA_PERMISO_CAJA[permiso]}
        </label>
      ))}
    </fieldset>
  );
}

function EmpleadosCaja({
  personas,
  aviso,
  pending,
  onVolver,
  onCrear,
  onPermisos,
}: {
  personas: PersonaCaja[];
  aviso: ReactNode;
  pending: boolean;
  onVolver: () => void;
  onCrear: (data: FormData) => void;
  onPermisos: (data: FormData) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const elegido = personas.find((p) => p.id === editando) ?? null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="font-display text-2xl font-bold">Empleados</h2>
      <p className="mt-1 text-sm">Entran con el mail o el teléfono y el PIN. Marcá qué partes del menú de caja pueden tocar.</p>
      <div className="mt-3">{aviso}</div>
      <form
        className={`${caja.panel} mt-4 grid gap-3 p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          onCrear(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CampoLocal nombre="nombre" etiqueta="Nombre" defaultValue="" required />
          <CampoLocal nombre="telefono" etiqueta="Teléfono" defaultValue="" />
          <CampoLocal nombre="email" etiqueta="Mail" defaultValue="" />
          <CampoLocal nombre="pin" etiqueta="PIN" defaultValue="" required />
        </div>
        <PermisosMenu elegidos={["venta", "listados", "stock", "clientes", "productos"]} />
        <button type="submit" disabled={pending} className={caja.primario}>
          {pending ? "Guardando…" : "Cargar empleado"}
        </button>
      </form>
      <ul className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {personas.map((p) => {
          const permisos = permisosCajaDe(p.rol, p.permisosCaja);
          return (
            <li key={p.id} className="border-b border-neutral-200 px-3 py-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{p.nombre}</p>
                  <p className="text-xs text-neutral-600">
                    {p.rol === "admin" ? "Administración · todo el menú" : permisos.map((permiso) => ETIQUETA_PERMISO_CAJA[permiso]).join(" · ")}
                  </p>
                  <p className="text-xs text-neutral-500">{p.telefono || p.email}</p>
                </div>
                {p.rol === "caja" && (
                  <button type="button" className={caja.boton} onClick={() => setEditando(editando === p.id ? null : p.id)}>
                    Permisos
                  </button>
                )}
              </div>
              {elegido?.id === p.id && (
                <form
                  className="mt-3 grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onPermisos(new FormData(e.currentTarget));
                  }}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <PermisosMenu elegidos={permisos} />
                  <button type="submit" disabled={pending} className={caja.primario}>
                    Guardar permisos
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className={`${BOTON} mt-4`} onClick={onVolver}>
        Volver
      </button>
    </section>
  );
}

function Regularizar({
  productos,
  movimientos,
  pending,
  aviso,
  onVolver,
  onGuardar,
}: {
  productos: ProductoCaja[];
  movimientos: RegularizacionStock[];
  pending: boolean;
  aviso: ReactNode;
  onVolver: () => void;
  onGuardar: (data: FormData) => void;
}) {
  const [q, setQ] = useState("");
  const [elegido, setElegido] = useState<string | null>(null);
  const [contado, setContado] = useState("");
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t
      ? productos.filter((p) => p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t))
      : productos;
    return base.slice(0, 12);
  }, [productos, q]);
  const producto = productos.find((p) => p.id === elegido) ?? null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="font-display text-2xl font-bold">Regularizar stock</h2>
      <p className="mt-1 text-sm">
        Contá lo que hay en la góndola y guardá ese número. Reemplaza el stock del sistema.
      </p>
      <div className="mt-3">{aviso}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o código"
        className={`${CAMPO} mt-3 max-w-md`}
      />
      <ul className="mt-2 max-h-64 overflow-auto overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {lista.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                elegido === p.id ? "bg-movipack/10" : "hover:bg-movipack/5"
              }`}
              onClick={() => {
                setElegido(p.id);
                setContado(p.stock == null ? "" : String(p.stock));
              }}
            >
              <span>
                {p.codigo} · {nombreVitrina(p.nombre)}
              </span>
              <span className="font-bold">{p.stock == null ? "Sin control" : p.stock}</span>
            </button>
          </li>
        ))}
      </ul>
      {producto && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData();
            data.set("productoId", producto.id);
            data.set("contado", contado);
            onGuardar(data);
          }}
        >
          <label className="text-sm font-bold">
            Stock contado de {producto.codigo}
            <input
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              inputMode="numeric"
              required
              className={`${CAMPO} mt-1 w-32`}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </form>
      )}
      <button type="button" className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-2 text-sm font-bold" onClick={onVolver}>
        Volver
      </button>
      {movimientos.length > 0 && (
        <>
          <h3 className="mt-8 text-lg font-black">Últimos cambios</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {movimientos.slice(0, 8).map((m) => (
              <li key={m.id}>
                {m.codigo} {nombreVitrina(m.nombre)}: {m.anterior == null ? "sin control" : m.anterior} → {m.nuevo}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function FichaSimple({
  titulo,
  ayuda,
  aviso,
  pending,
  campos,
  filas,
  onVolver,
  onGuardar,
  onQuitar,
}: {
  titulo: string;
  ayuda?: string;
  aviso: ReactNode;
  pending: boolean;
  campos: { name: string; label: string; required?: boolean }[];
  filas: { id: string; titulo: string; detalle: string }[];
  onVolver: () => void;
  onGuardar: (data: FormData) => void;
  onQuitar?: (id: string) => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="font-display text-2xl font-bold">{titulo}</h2>
      {ayuda && <p className="mt-1 text-sm">{ayuda}</p>}
      <div className="mt-3">{aviso}</div>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          onGuardar(new FormData(form));
          form.reset();
        }}
      >
        {campos.map((campo) => (
          <label key={campo.name} className="text-sm font-bold">
            {campo.label}
            <input name={campo.name} required={campo.required} className={`${CAMPO} mt-1`} />
          </label>
        ))}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-2 text-sm font-bold" onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
      <ul className="mt-5 max-h-80 space-y-1 overflow-auto">
        {filas.length === 0 && <li className="text-sm">Todavía no hay fichas.</li>}
        {filas.map((fila) => (
          <li key={fila.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{fila.titulo}</span>
              {fila.detalle && <span className="text-neutral-600">{fila.detalle}</span>}
            </span>
            {onQuitar && (
              <button type="button" className="font-bold text-red-700" onClick={() => onQuitar(fila.id)}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EnvioDomicilio({ escala, onVolver }: { escala: EscalaEnvio; onVolver: () => void }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdmin>(null);
  const [pending, start] = useTransition();
  const [valores, setValores] = useState({
    base: String(escala.base),
    medioDesde: String(escala.medioDesde),
    medio: String(escala.medio),
    bajoDesde: String(escala.bajoDesde),
    bajo: String(escala.bajo),
    sinCargoDesde: String(escala.sinCargoDesde),
  });

  function campo(nombre: keyof typeof valores, etiqueta: string) {
    return (
      <label key={nombre} className="text-sm font-bold">
        {etiqueta}
        <input
          name={nombre}
          inputMode="numeric"
          value={textoMonto(valores[nombre])}
          onChange={(e) => setValores((prev) => ({ ...prev, [nombre]: digitosMonto(e.target.value) }))}
          className={`${CAMPO} mt-1`}
        />
      </label>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Envío a domicilio</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Estos importes los usa la caja cuando agregás el envío a una venta, y también el pedido online. El costo sale del total de los productos.
      </p>
      <form
        className={`${caja.panel} mt-4 grid gap-3 p-4 sm:grid-cols-2`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            const resultado = await guardarEnvioAdmin(data);
            setMensaje(resultado);
            if (resultado?.ok) router.refresh();
          });
        }}
      >
        {mensaje?.error && <p className={`${caja.avisoErrorPlano} mb-1 sm:col-span-2`}>{mensaje.error}</p>}
        {mensaje?.ok && <p className={`${caja.avisoOkPlano} mb-1 sm:col-span-2`}>{mensaje.ok}</p>}
        {campo("base", "Envío si el pedido es más chico")}
        {campo("medioDesde", "A partir de este total")}
        {campo("medio", "El envío baja a")}
        {campo("bajoDesde", "A partir de este total")}
        {campo("bajo", "El envío baja a")}
        {campo("sinCargoDesde", "Envío sin cargo desde")}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={caja.boton} onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
    </section>
  );
}

function DatosDelLocal({ onVolver }: { onVolver: () => void }) {
  const [datos, setDatos] = useState<DatosLocal | null>(null);
  const [mensaje, setMensaje] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void leerDatosLocal().then(setDatos);
  }, []);

  if (!datos) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-neutral-600">Cargando datos del local…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Datos del local</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Nombre, contacto, horarios, logo del presupuesto y el alias o CBU que ve el cliente cuando paga por transferencia.
      </p>
      <form
        className={`${caja.panel} mt-4 grid gap-3 p-4 sm:grid-cols-2`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            const resultado = await guardarDatosLocal(data);
            setMensaje(resultado);
            if (resultado?.ok) setDatos(await leerDatosLocal());
          });
        }}
      >
        {mensaje?.error && <p className={`${caja.avisoErrorPlano} sm:col-span-2`}>{mensaje.error}</p>}
        {mensaje?.ok && <p className={`${caja.avisoOkPlano} sm:col-span-2`}>{mensaje.ok}</p>}
        <CampoLocal nombre="nombre" etiqueta="Nombre del local" defaultValue={datos.nombre} required />
        <CampoLocal nombre="mail" etiqueta="Mail" type="email" defaultValue={datos.mail} />
        <CampoLocal nombre="telefono" etiqueta="Teléfono" defaultValue={datos.telefono} />
        <CampoLocal nombre="direccion" etiqueta="Dirección" defaultValue={datos.direccion} />
        <CampoLocal nombre="horarios" etiqueta="Horarios" defaultValue={datos.horarios} ancho />
        <CampoLocal nombre="alias" etiqueta="Alias de transferencia" defaultValue={datos.alias} />
        <CampoLocal nombre="cbu" etiqueta="CBU" defaultValue={datos.cbu} />
        <CampoLocal nombre="titular" etiqueta="Titular" defaultValue={datos.titular} />
        <CampoLocal nombre="banco" etiqueta="Banco" defaultValue={datos.banco} />
        <CampoLocal
          nombre="demoraEntrega"
          etiqueta="Tiempo estimado si pide lo antes posible"
          defaultValue={datos.demoraEntrega || DEMORA_ENTREGA_BASE}
          required
          ancho
        />
        <div className="sm:col-span-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="text-sm font-black">Logo del presupuesto</p>
          <p className="mt-1 text-xs text-neutral-600">
            Se usa al generar un presupuesto desde la venta. Si no cargás uno, se usa el logo del sitio.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={datos.logo || "/recursos/logo.jpg"}
              alt="Logo actual"
              className="h-20 w-20 rounded-xl border border-neutral-200 bg-white object-contain p-1"
            />
            <label className="block text-xs font-bold text-neutral-600">
              Cambiar logo
              <input
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 block w-full text-sm font-semibold"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={caja.boton} onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
    </section>
  );
}

function CampoLocal({
  nombre,
  etiqueta,
  defaultValue,
  type = "text",
  required,
  ancho,
}: {
  nombre: string;
  etiqueta: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  ancho?: boolean;
}) {
  return (
    <label className={`block text-xs font-bold text-neutral-600 ${ancho ? "sm:col-span-2" : ""}`}>
      {etiqueta}
      <input
        name={nombre}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={`${CAMPO} mt-1`}
      />
    </label>
  );
}

function Porcentajes({
  titulo,
  detalle,
  campos,
}: {
  titulo: string;
  detalle: string;
  campos: { name: string; label: string; valor: number }[];
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-black">{titulo}</legend>
      <p className="mt-1 text-xs text-neutral-600">{detalle}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {campos.map((campo) => (
          <label key={campo.name} className="text-xs font-bold text-neutral-600">
            {campo.label}
            <input
              type="number"
              name={campo.name}
              defaultValue={campo.valor}
              min={0}
              max={500}
              step={0.1}
              className={`${CAMPO} mt-1`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CatalogoWeb({
  recargo,
  descuento,
  onVolver,
}: {
  recargo: number;
  descuento: number;
  onVolver: () => void;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdmin>(null);
  const [pending, start] = useTransition();
  const [recargoVista, setRecargoVista] = useState(String(recargo));
  const [descuentoVista, setDescuentoVista] = useState(String(descuento));
  const recargoNum = Math.min(200, Math.max(0, Math.round(Number(recargoVista) || 0)));
  const descuentoNum = Math.min(90, Math.max(0, Math.round(Number(descuentoVista) || 0)));
  const base = 10000;
  const normal = Math.round(base * (1 + recargoNum / 100));
  const clientes = Math.round(normal * (1 - descuentoNum / 100));

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Catálogo web</h2>
      <p className="mt-2 text-sm text-neutral-600">
        El catálogo usa el precio guardado de cada producto. El recargo se suma a ese precio. Al lado se muestra el descuento de los clientes registrados.
      </p>
      <form
        className={`${caja.panel} mt-4 space-y-4 p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            const resultado = await guardarCatalogoWeb(data);
            setMensaje(resultado);
            if (resultado?.ok) router.refresh();
          });
        }}
      >
        {mensaje?.error && <p className={caja.avisoErrorPlano}>{mensaje.error}</p>}
        {mensaje?.ok && <p className={caja.avisoOkPlano}>{mensaje.ok}</p>}
        <label className="block text-sm font-bold">
          Recargo sobre el precio de la base
          <span className="mt-1 flex items-center gap-2">
            <input
              type="number"
              name="recargoWeb"
              value={recargoVista}
              min={0}
              max={200}
              step={1}
              onChange={(e) => setRecargoVista(e.target.value)}
              className="w-28 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-2xl font-bold"
            />
            %
          </span>
          <span className="mt-1 block text-xs font-semibold text-neutral-600">
            0 deja el precio tal cual está en la base. Un producto de {formatoPesos(base)} se publica a {formatoPesos(normal)}.
          </span>
        </label>
        <label className="block text-sm font-bold">
          Descuento de clientes generales
          <span className="mt-1 flex items-center gap-2">
            <input
              type="number"
              name="descuentoClienteGenerico"
              value={descuentoVista}
              min={0}
              max={90}
              step={1}
              onChange={(e) => setDescuentoVista(e.target.value)}
              className="w-28 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-2xl font-bold"
            />
            %
          </span>
          <span className="mt-1 block text-xs font-semibold text-neutral-600">
            Se muestra al lado del precio normal. En el ejemplo, los clientes ven {formatoPesos(clientes)}. El descuento especial de una ficha, si lo tiene, reemplaza a este.
          </span>
        </label>
        <div className="flex items-end justify-between gap-3 rounded-2xl border border-movipack/30 bg-movipack/5 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Precio</p>
            <p className="font-display text-3xl font-bold">{formatoPesos(normal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-cape">Clientes -{descuentoNum}%</p>
            <p className="font-display text-3xl font-bold text-cape">{formatoPesos(clientes)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={caja.boton} onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
      <div className={`${caja.panel} mt-4 p-4`}>
        <p className="font-bold">Catálogo de precios</p>
        <p className="mt-1 text-sm text-neutral-600">
          Foto, nombre, precio del catálogo y precio con el descuento de cliente registrado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/admin/catalogo-precios?formato=xlsx" className={caja.primario}>
            Descargar Excel
          </a>
          <a href="/admin/catalogo-precios?formato=pdf" className={caja.boton}>
            Descargar PDF
          </a>
        </div>
      </div>
    </section>
  );
}

function DescuentoClientes({
  tasasCuota,
  moraCredito,
  moraCuenta,
  plazoCuenta,
  onVolver,
}: {
  tasasCuota: { 1: number; 2: number; 3: number; 6: number };
  moraCredito: number[];
  moraCuenta: number[];
  plazoCuenta: number;
  onVolver: () => void;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdmin>(null);
  const [pending, start] = useTransition();

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Intereses créditos y cuentas corrientes</h2>
      <p className="mt-2 text-sm text-neutral-600">
        El interés de las cuotas y el recargo si no pagan el crédito o la mercadería de cuenta corriente.
      </p>
      <form
        className={`${caja.panel} mt-4 p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            const resultado = await guardarPreciosAdmin(null, data);
            setMensaje(resultado);
            if (resultado?.ok) router.refresh();
          });
        }}
      >
        {mensaje?.error && <p className={`${caja.avisoErrorPlano} mb-3`}>{mensaje.error}</p>}
        {mensaje?.ok && <p className={`${caja.avisoOkPlano} mb-3`}>{mensaje.ok}</p>}
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="font-display text-xl font-bold">Crédito</h3>
          <p className="mt-1 text-xs text-neutral-600">
            El interés de cada cuota y, aparte, el interés semanal si esas cuotas se vencen. Una ficha puede usar esta escala o una propia.
          </p>
          <Porcentajes
            titulo="Interés de las cuotas"
            detalle="1, 2, 3 y 6 cuotas. Se usa cuando la ficha dice escala general."
            campos={[
              { name: "interes1", label: "1 cuota %", valor: tasasCuota[1] },
              { name: "interes2", label: "2 cuotas %", valor: tasasCuota[2] },
              { name: "interes3", label: "3 cuotas %", valor: tasasCuota[3] },
              { name: "interes6", label: "6 cuotas %", valor: tasasCuota[6] },
            ]}
          />
          <Porcentajes
            titulo="Si no paga el crédito"
            detalle="Porcentaje sobre el capital vencido, por semana de atraso."
            campos={[1, 2, 3, 4].map((semana) => ({
              name: `moraCredito${semana}`,
              label: `${semana}ª semana %`,
              valor: moraCredito[semana - 1] ?? 0,
            }))}
          />
        </section>
        <section className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="font-display text-xl font-bold">Cuenta corriente</h3>
          <p className="mt-1 text-xs text-neutral-600">
            La mercadería no tiene interés durante el plazo. Después, cada semana de impago usa esta escala, salvo que la ficha tenga una propia.
          </p>
          <label className="mt-4 block text-sm font-bold">
            Días para pagar la mercadería
            <input
              type="number"
              name="plazoCuenta"
              defaultValue={plazoCuenta}
              min={1}
              max={365}
              step={1}
              className={`${CAMPO} mt-1 w-32`}
            />
            <span className="mt-1 block text-xs font-semibold text-neutral-600">
              Puede ser 7, 14 u otra cantidad. Una ficha puede usar otro plazo.
            </span>
          </label>
          <Porcentajes
            titulo="Si no paga la mercadería"
            detalle="Empieza recién cuando se vence el plazo de pago."
            campos={[1, 2, 3, 4].map((semana) => ({
              name: `moraCuenta${semana}`,
              label: `${semana}ª semana %`,
              valor: moraCuenta[semana - 1] ?? 0,
            }))}
          />
        </section>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={caja.boton} onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
    </section>
  );
}

function MediosPago({
  medios,
  pending,
  aviso,
  onVolver,
  onGuardar,
  onQuitar,
}: {
  medios: MedioPago[];
  pending: boolean;
  aviso: ReactNode;
  onVolver: () => void;
  onGuardar: (data: FormData) => void;
  onQuitar: (data: FormData) => void;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Medios de pago</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Estos botones aparecen al cobrar. El marcado como efectivo pide con cuánto paga el cliente y muestra el vuelto. Contado es el efectivo inicial.
      </p>
      <div className="mt-4">{aviso}</div>
      <form
        className={`${caja.panel} mt-2 grid gap-3 p-4 sm:grid-cols-[1fr_auto]`}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          onGuardar(new FormData(form));
          form.reset();
        }}
      >
        <label className="text-sm font-bold">
          Nombre
          <input name="nombre" required minLength={2} placeholder="Ej: Transferencia" className={`${CAMPO} mt-1`} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-bold">
          <input type="checkbox" name="efectivo" value="1" className="mb-3 h-4 w-4" />
          Efectivo
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Guardando…" : "Agregar"}
          </button>
          <button type="button" className={caja.boton} onClick={onVolver}>
            Volver
          </button>
        </div>
      </form>
      <ul className="mt-4 space-y-2">
        {medios.map((medio) => (
          <li key={medio.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <span className="min-w-0 flex-1 font-bold">{medio.nombre}</span>
            {medio.efectivo && (
              <span className="rounded-full bg-confetti/40 px-2 py-1 text-xs font-bold">Efectivo</span>
            )}
            <button
              type="button"
              disabled={pending || medios.length < 2}
              className="text-sm font-bold text-cape disabled:opacity-40"
              onClick={() => {
                if (!window.confirm(`¿Quitar ${medio.nombre}?`)) return;
                const data = new FormData();
                data.set("id", medio.id);
                onQuitar(data);
              }}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Secciones({
  rubros,
  productos,
  onVolver,
}: {
  rubros: Rubro[];
  productos: Producto[];
  onVolver: () => void;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoAdmin>(null);
  const [pending, start] = useTransition();
  const cantidades = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const producto of productos) {
      mapa[producto.seccion] = (mapa[producto.seccion] ?? 0) + 1;
    }
    return mapa;
  }, [productos]);

  function run(tarea: () => Promise<EstadoAdmin>) {
    setMensaje(null);
    start(async () => {
      const resultado = await tarea();
      setMensaje(resultado);
      if (resultado?.ok) router.refresh();
    });
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-6">
      <p className={caja.kicker}>Mantenimiento</p>
      <h2 className="font-display text-3xl font-bold">Secciones</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        La foto de cada sección es la que se ve en el inicio. Si creás o eliminás una, el inicio y el catálogo se actualizan. Varios no se puede eliminar: si borrás otra, sus productos pasan ahí.
      </p>
      {mensaje?.error && <p className={`${caja.avisoErrorPlano} mt-4`}>{mensaje.error}</p>}
      {mensaje?.ok && <p className={`${caja.avisoOkPlano} mt-4`}>{mensaje.ok}</p>}

      <ul className="mt-5 space-y-3">
        {rubros.map((rubro) => {
          const cantidad = cantidades[rubro.clave] ?? 0;
          const reservado = rubro.clave === RUBRO_RESERVADO;
          return (
            <li key={rubro.clave} className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:grid-cols-[5.5rem_1fr_auto]">
              <div>
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-neutral-100 sm:h-20 sm:w-20">
                  {rubro.imagen ? (
                    <img src={rubro.imagen} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-1 text-center text-[10px] font-bold text-neutral-400">
                      Sin foto
                    </div>
                  )}
                </div>
                <label className="mt-1 block cursor-pointer text-center text-xs font-bold text-movipack">
                  {rubro.imagen ? "Cambiar" : "Cargar"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={pending}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      e.target.value = "";
                      if (!archivo) return;
                      const data = new FormData();
                      data.set("clave", rubro.clave);
                      data.set("imagen", archivo);
                      run(() => subirImagenRubro(data));
                    }}
                  />
                </label>
              </div>
              <form
                className="min-w-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  data.set("clave", rubro.clave);
                  run(() => renombrarRubro(data));
                }}
              >
                <input
                  name="etiqueta"
                  required
                  minLength={3}
                  defaultValue={rubro.etiqueta}
                  key={rubro.etiqueta}
                  className={CAMPO}
                />
                <p className="mt-1 text-xs font-semibold text-neutral-500">
                  {`${cantidad} ${cantidad === 1 ? "producto" : "productos"}`}
                </p>
                <button type="submit" disabled={pending} className="mt-2 text-sm font-bold text-movipack disabled:opacity-50">
                  Renombrar
                </button>
              </form>
              <div className="col-start-2 flex items-start sm:col-start-auto sm:items-center">
                {reservado ? (
                  <span className="text-xs font-semibold text-neutral-400">No se puede eliminar</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm font-bold text-cape disabled:opacity-50"
                    onClick={() => {
                      const ok = window.confirm(
                        cantidad > 0
                          ? `¿Eliminar la sección "${rubro.etiqueta}"? ${cantidad} producto${cantidad === 1 ? "" : "s"} van a pasar a Varios.`
                          : `¿Eliminar la sección "${rubro.etiqueta}"?`,
                      );
                      if (!ok) return;
                      const data = new FormData();
                      data.set("clave", rubro.clave);
                      run(() => eliminarRubro(data));
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-6 rounded-2xl border border-dashed border-movipack/40 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          run(async () => {
            const resultado = await crearRubro(new FormData(form));
            if (resultado?.ok) form.reset();
            return resultado;
          });
        }}
      >
        <h3 className="font-display text-xl font-bold">Crear sección</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Aparece en el inicio y en el catálogo. Si cargás una foto, esa es la de la grilla.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input name="etiqueta" required minLength={3} placeholder="Ej: Vasos" className={`${CAMPO} min-w-48 flex-1`} />
          <input name="imagen" type="file" accept="image/jpeg,image/png,image/webp" className="max-w-full text-sm" />
          <button type="submit" disabled={pending} className={caja.primario}>
            {pending ? "Creando…" : "Crear sección"}
          </button>
        </div>
      </form>
      <button type="button" className={`${caja.boton} mt-4`} onClick={onVolver}>
        Volver
      </button>
    </section>
  );
}
