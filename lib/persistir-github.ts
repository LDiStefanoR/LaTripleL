import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

const RUTAS = [
  "recursos/imagenes-productos",
  "recursos/imagenes-rubros",
  "recursos/web",
  "data/productos.json",
  "data/rubros.json",
  "data/ajustes.json",
];

export function fotosEnGithub() {
  return process.env.FOTOS_EN_GITHUB === "1";
}

async function git(args: string[]) {
  try {
    const { stdout, stderr } = await exec("git", args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (error) {
    const err = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "",
    };
  }
}

export async function persistirFotosGithub(): Promise<string> {
  if (!fotosEnGithub() || process.env.VERCEL === "1") return "";

  const agregado = await git(["add", "-A", "--", ...RUTAS]);
  if (agregado.code !== 0) {
    console.error("[github-fotos]", agregado.stderr);
    return "";
  }

  const pendiente = await git(["diff", "--cached", "--quiet", "--", ...RUTAS]);
  if (pendiente.code === 0) return "";

  const commit = await git([
    "commit",
    "--only",
    "-m",
    "Actualizamos fotos del sitio.",
    "--",
    ...RUTAS,
  ]);
  if (commit.code !== 0) {
    console.error("[github-fotos]", commit.stderr);
    return "";
  }

  const push = await git(["push", "origin", "HEAD"]);
  if (push.code !== 0) {
    console.error("[github-fotos]", push.stderr);
    return "";
  }

  return "";
}
