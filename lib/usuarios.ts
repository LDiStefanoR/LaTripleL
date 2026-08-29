import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  EMAIL_ADMIN,
  EMAIL_CLIENTE_DEMO,
  PASSWORD_ADMIN_SEMILLA,
  normalizarEmailLogin,
} from "@/lib/auth-config";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import { parseTipoCuenta } from "@/lib/tipo-cuenta";
import type {
  EstadoCuenta,
  PerfilCliente,
  RolUsuario,
  TipoCuentaCliente,
  Usuario,
  UsuarioPublico,
} from "@/types/auth";

const rondas = 10;

export function normalizarEmail(email: string) {
  return normalizarEmailLogin(email);
}

export function sinPassword(usuario: Usuario): UsuarioPublico {
  const { passwordHash: _omitido, ...resto } = usuario;
  return resto;
}

function normalizarUsuario(
  raw: Partial<Usuario> & Pick<Usuario, "email" | "id">,
): Usuario {
  return {
    id: raw.id,
    email: normalizarEmail(raw.email),
    nombre: raw.nombre?.trim() || raw.email,
    rol: raw.rol === "admin" ? "admin" : "cliente",
    passwordHash: raw.passwordHash ?? "",
    estado: raw.estado ?? "activa",
    perfil: raw.perfil,
    tipoCuenta: raw.rol === "admin" ? undefined : parseTipoCuenta(raw.tipoCuenta),
    notaInterna: raw.notaInterna?.trim() || "",
    creadoEn: raw.creadoEn ?? new Date().toISOString(),
  };
}

async function leerArchivo(): Promise<Usuario[]> {
  const parsed = await leerJsonData<Partial<Usuario>[]>("usuarios.json", []);
  if (!Array.isArray(parsed)) return [];
  const crudos = parsed.filter((u) => u?.id && u?.email);
  const hayTiposNuevos = crudos.some(
    (u) =>
      u.tipoCuenta === "descuentos" ||
      u.tipoCuenta === "credito_super" ||
      u.tipoCuenta === "linea_credito",
  );
  if (!hayTiposNuevos) {
    for (const u of crudos) {
      if (u.rol === "admin") continue;
      if (u.tipoCuenta === "credito") u.tipoCuenta = "credito_super";
      else u.tipoCuenta = "descuentos";
    }
  }
  const usuarios = crudos.map((u) => normalizarUsuario(u as Usuario));
  if (!hayTiposNuevos && usuarios.some((u) => u.rol === "cliente")) {
    await escribirArchivo(usuarios);
  }
  return usuarios;
}

async function escribirArchivo(usuarios: Usuario[]) {
  await escribirJsonData("usuarios.json", usuarios);
}

async function asegurarSemilla() {
  const usuarios = await leerArchivo();
  const porEmail = new Map(usuarios.map((u) => [normalizarEmail(u.email), u]));
  let cambio = false;

  const semillas = [
    {
      email: EMAIL_ADMIN,
      nombre: "Administración",
      rol: "admin" as const,
      password: "Oficina123",
      perfil: undefined as PerfilCliente | undefined,
    },
    {
      email: EMAIL_CLIENTE_DEMO,
      nombre: "Cliente genérico",
      rol: "cliente" as const,
      password: "Oficina123",
      perfil: {
        tipoPersona: "persona" as const,
        tipoLocal: "Comercio",
        productosInteres: "Almacén y bebidas",
        direccion: "Garay 1005, Rosario",
        telefono: "3410000000",
        horarioAtencion: "Lunes a viernes 9 a 18",
        deseaAsesor: false,
      },
    },
  ];

  for (const s of semillas) {
    const email = normalizarEmail(s.email);
    const existente = porEmail.get(email);
    if (existente) {
      if (existente.estado !== "activa") {
        existente.estado = "activa";
        cambio = true;
      }
      if (s.perfil && !existente.perfil) {
        existente.perfil = s.perfil;
        cambio = true;
      }
      continue;
    }
    const passwordHash = await bcrypt.hash(s.password, rondas);
    const creado: Usuario = {
      id: randomUUID(),
      email,
      nombre: s.nombre,
      rol: s.rol,
      passwordHash,
      estado: "activa",
      perfil: s.perfil,
      creadoEn: new Date().toISOString(),
    };
    usuarios.push(creado);
    porEmail.set(email, creado);
    cambio = true;
  }

  if (cambio) {
    try {
      await escribirArchivo(usuarios);
    } catch (error) {
      console.error("[usuarios] No se pudo guardar la semilla", error);
    }
  }
  return usuarios;
}

export async function listarUsuarios() {
  return asegurarSemilla();
}

export async function buscarUsuarioPorEmail(email: string) {
  const usuarios = await asegurarSemilla();
  const clave = normalizarEmail(email);
  return usuarios.find((u) => u.email === clave) ?? null;
}

export async function asegurarAdminConClave(password: string) {
  if (password !== PASSWORD_ADMIN_SEMILLA) return null;
  const usuarios = await asegurarSemilla();
  const admin = usuarios.find((u) => u.email === EMAIL_ADMIN);
  if (!admin) return null;
  admin.rol = "admin";
  admin.estado = "activa";
  admin.passwordHash = await bcrypt.hash(PASSWORD_ADMIN_SEMILLA, rondas);
  await escribirArchivo(usuarios);
  return admin;
}

export async function buscarUsuarioPorId(id: string) {
  const usuarios = await asegurarSemilla();
  return usuarios.find((u) => u.id === id) ?? null;
}

export function validarPerfil(perfil: PerfilCliente) {
  if (perfil.tipoPersona !== "persona" && perfil.tipoPersona !== "empresa") {
    return "Elegí si sos persona o empresa.";
  }
  if (perfil.tipoLocal.trim().length < 2) return "Ingresá el tipo de local.";
  if (perfil.productosInteres.trim().length < 3) {
    return "Contanos qué productos te interesan.";
  }
  if (perfil.direccion.trim().length < 5) return "Ingresá una dirección.";
  if (perfil.telefono.replace(/\D/g, "").length < 8) {
    return "Ingresá un teléfono válido.";
  }
  if (perfil.franjaReparto !== "manana" && perfil.franjaReparto !== "tarde") {
    return "Elegí la franja de entrega: mañana (9 a 13) o tarde (18 a 20).";
  }
  return null;
}

export async function solicitarCuenta(datos: {
  email: string;
  nombre: string;
  password: string;
  perfil: PerfilCliente;
}) {
  const email = normalizarEmail(datos.email);
  if (!email.includes("@")) {
    return { error: "Ingresá un mail válido." as const };
  }
  if (datos.nombre.trim().length < 2) {
    return { error: "Ingresá tu nombre o razón social." as const };
  }
  if (datos.password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." as const };
  }
  const errorPerfil = validarPerfil(datos.perfil);
  if (errorPerfil) return { error: errorPerfil };
  if (email === EMAIL_ADMIN) {
    return { error: "Ese mail no se puede usar para registrarse." as const };
  }

  const usuarios = await asegurarSemilla();
  if (usuarios.some((u) => u.email === email)) {
    return { error: "Ese mail ya está registrado o tiene una solicitud." as const };
  }

  const passwordHash = await bcrypt.hash(datos.password, rondas);
  const usuario: Usuario = {
    id: randomUUID(),
    email,
    nombre: datos.nombre.trim(),
    rol: "cliente",
    passwordHash,
    estado: "pendiente",
    tipoCuenta: "generico",
    perfil: {
      ...datos.perfil,
      tipoLocal: datos.perfil.tipoLocal.trim(),
      productosInteres: datos.perfil.productosInteres.trim(),
      direccion: datos.perfil.direccion.trim(),
      telefono: datos.perfil.telefono.trim(),
      horarioAtencion: datos.perfil.horarioAtencion.trim(),
    },
    creadoEn: new Date().toISOString(),
  };
  usuarios.push(usuario);
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function crearUsuarioAdmin(datos: {
  email: string;
  nombre: string;
  password: string;
  rol: RolUsuario;
  tipoCuenta?: TipoCuentaCliente;
}) {
  const email = normalizarEmail(datos.email);
  if (!email.includes("@")) return { error: "Ingresá un mail válido." as const };
  if (datos.nombre.trim().length < 2) return { error: "Ingresá un nombre." as const };
  const errorPin = pinOPasswordValido(datos.password);
  if (errorPin) return { error: errorPin };
  const usuarios = await asegurarSemilla();
  if (usuarios.some((u) => u.email === email)) {
    return { error: "Ese mail ya existe." as const };
  }
  const passwordHash = await bcrypt.hash(datos.password, rondas);
  const usuario: Usuario = {
    id: randomUUID(),
    email,
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    passwordHash,
    estado: "activa",
    tipoCuenta:
      datos.rol === "cliente"
        ? parseTipoCuenta(datos.tipoCuenta ?? "generico")
        : undefined,
    creadoEn: new Date().toISOString(),
  };
  usuarios.push(usuario);
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarEstadoCuenta(id: string, estado: EstadoCuenta) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN && estado !== "activa") {
    return { error: "La cuenta principal de administración no se puede desactivar." as const };
  }
  usuario.estado = estado;
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarRolUsuario(id: string, rol: RolUsuario) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN && rol !== "admin") {
    return { error: "La cuenta principal tiene que seguir siendo administradora." as const };
  }
  const admins = usuarios.filter((u) => u.rol === "admin" && u.estado === "activa");
  if (usuario.rol === "admin" && rol !== "admin" && admins.length <= 1) {
    return { error: "Tiene que quedar al menos un administrador activo." as const };
  }
  usuario.rol = rol;
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarPasswordUsuario(id: string, password: string) {
  const errorPin = pinOPasswordValido(password);
  if (errorPin) return { error: errorPin };
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  usuario.passwordHash = await bcrypt.hash(password, rondas);
  await escribirArchivo(usuarios);
  return { ok: true as const };
}

export async function cambiarEmailUsuario(id: string, emailNuevo: string) {
  const email = normalizarEmail(emailNuevo);
  if (!email.includes("@")) return { error: "Ingresá un mail válido." as const };
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN) {
    return { error: "El mail de administración no se puede cambiar acá." as const };
  }
  if (email === EMAIL_ADMIN) {
    return { error: "Ese mail no se puede usar." as const };
  }
  if (usuarios.some((u) => u.id !== id && u.email === email)) {
    return { error: "Ese mail ya está en uso." as const };
  }
  const anterior = usuario.email;
  usuario.email = email;
  await escribirArchivo(usuarios);
  return { ok: true as const, anterior, email };
}

export async function actualizarTipoCuenta(
  id: string,
  tipo: TipoCuentaCliente,
) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.rol === "admin") {
    return { error: "Un administrador no usa cuenta de cliente." as const };
  }
  usuario.tipoCuenta = tipo;
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function actualizarContactoCliente(
  id: string,
  datos: {
    nombre?: string;
    telefono: string;
    direccion: string;
    franjaReparto?: "manana" | "tarde";
    fotoPerfil?: string;
  },
) {
  if (datos.direccion.trim().length < 5) return { error: "Ingresá una dirección." as const };
  if (datos.telefono.replace(/\D/g, "").length < 8) {
    return { error: "Ingresá un teléfono válido." as const };
  }
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (datos.nombre && datos.nombre.trim().length >= 2) {
    usuario.nombre = datos.nombre.trim();
  }
  const base = usuario.perfil ?? perfilFiado(datos.telefono);
  usuario.perfil = {
    ...base,
    telefono: datos.telefono.trim(),
    direccion: datos.direccion.trim(),
    franjaReparto: datos.franjaReparto ?? base.franjaReparto,
    horarioAtencion:
      datos.franjaReparto === "manana"
        ? "Mañana (9 a 13)"
        : datos.franjaReparto === "tarde"
          ? "Tarde (18 a 20)"
          : base.horarioAtencion,
    fotoPerfil: datos.fotoPerfil ?? base.fotoPerfil,
  };
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function actualizarPerfilUsuario(
  id: string,
  datos: { nombre: string; perfil: PerfilCliente; notaInterna?: string },
) {
  if (datos.nombre.trim().length < 2) return { error: "Ingresá un nombre." as const };
  const telefono = datos.perfil.telefono.replace(/\D/g, "");
  if (telefono && telefono.length < 8) {
    return { error: "Ingresá un teléfono válido (al menos 8 números)." as const };
  }
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  usuario.nombre = datos.nombre.trim();
  const base = usuario.perfil;
  usuario.perfil = {
    tipoPersona: datos.perfil.tipoPersona === "empresa" ? "empresa" : "persona",
    tipoLocal: datos.perfil.tipoLocal.trim() || base?.tipoLocal || "",
    productosInteres:
      datos.perfil.productosInteres.trim() || base?.productosInteres || "",
    direccion: datos.perfil.direccion.trim(),
    telefono: datos.perfil.telefono.trim(),
    horarioAtencion:
      datos.perfil.horarioAtencion.trim() || base?.horarioAtencion || "",
    deseaAsesor: datos.perfil.deseaAsesor,
    franjaReparto: datos.perfil.franjaReparto ?? base?.franjaReparto,
    fotoPerfil: base?.fotoPerfil,
  };
  if (datos.notaInterna !== undefined) {
    usuario.notaInterna = datos.notaInterna.trim();
  }
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function eliminarUsuario(id: string, quienEliminaEmail: string) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN) {
    return { error: "La cuenta principal de administración no se puede eliminar." as const };
  }
  if (usuario.email === normalizarEmail(quienEliminaEmail)) {
    return { error: "No podés eliminar tu propia cuenta." as const };
  }
  const admins = usuarios.filter((u) => u.rol === "admin" && u.estado === "activa");
  if (usuario.rol === "admin" && admins.length <= 1) {
    return { error: "Tiene que quedar al menos un administrador." as const };
  }
  await escribirArchivo(usuarios.filter((u) => u.id !== id));
  return { ok: true as const };
}

export async function verificarPassword(usuario: Usuario, password: string) {
  return bcrypt.compare(password, usuario.passwordHash);
}

function perfilFiado(telefono: string): PerfilCliente {
  const tel = telefono.replace(/\D/g, "");
  return {
    tipoPersona: "persona",
    tipoLocal: "Cuenta corriente",
    productosInteres: "Fiado almacén",
    direccion: "A coordinar",
    telefono: tel.length >= 8 && !/^0+$/.test(tel) ? telefono.trim() : "3410000000",
    horarioAtencion: "A coordinar",
    deseaAsesor: false,
  };
}

export function pinOPasswordValido(password: string) {
  if (/^\d{4,8}$/.test(password.trim())) return null;
  if (password.length < 8) {
    return "Usá un PIN de 4 a 8 números o una contraseña de al menos 8 caracteres.";
  }
  return null;
}

export async function asegurarUsuariosFiado(
  lista: { email: string; nombre: string; telefono: string; pin: string }[],
) {
  const usuarios = await asegurarSemilla();
  const porEmail = new Map(usuarios.map((u) => [normalizarEmail(u.email), u]));
  let cambio = false;

  for (const datos of lista) {
    const email = normalizarEmail(datos.email);
    if (!email.includes("@")) continue;
    const existente = porEmail.get(email);
    if (existente) {
      if (existente.estado !== "activa") {
        existente.estado = "activa";
        cambio = true;
      }
      if (!existente.perfil) {
        existente.perfil = perfilFiado(datos.telefono);
        cambio = true;
      }
      continue;
    }
    const pin = datos.pin.trim() || "1234";
    const creado: Usuario = {
      id: randomUUID(),
      email,
      nombre: datos.nombre.trim() || email,
      rol: "cliente",
      passwordHash: await bcrypt.hash(pin, rondas),
      estado: "activa",
      perfil: perfilFiado(datos.telefono),
      tipoCuenta: "credito_super",
      creadoEn: new Date().toISOString(),
    };
    usuarios.push(creado);
    porEmail.set(email, creado);
    cambio = true;
  }

  if (cambio) {
    try {
      await escribirArchivo(usuarios);
    } catch (error) {
      console.error("[usuarios] No se pudieron crear las cuentas de fiado", error);
    }
  }
  return usuarios;
}
