export type RolUsuario = "admin" | "cliente";

export type EstadoCuenta = "pendiente" | "activa" | "rechazada";

export type TipoPersona = "persona" | "empresa";

export type TipoCuentaCliente =
  | "generico"
  | "descuentos"
  | "credito_super"
  | "linea_credito";

export type PerfilCliente = {
  tipoPersona: TipoPersona;
  tipoLocal: string;
  productosInteres: string;
  direccion: string;
  telefono: string;
  horarioAtencion: string;
  deseaAsesor: boolean;
  franjaReparto?: "manana" | "tarde";
  fotoPerfil?: string;
};

export type SesionPublica = {
  email: string;
  nombre: string;
  rol: RolUsuario;
  tipoCuenta?: TipoCuentaCliente;
};

export type Usuario = SesionPublica & {
  id: string;
  passwordHash: string;
  estado: EstadoCuenta;
  perfil?: PerfilCliente;
  tipoCuenta?: TipoCuentaCliente;
  notaInterna?: string;
  creadoEn: string;
};

export type UsuarioPublico = Omit<Usuario, "passwordHash">;
