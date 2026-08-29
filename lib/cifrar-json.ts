import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { secretSesion } from "@/lib/auth-config";

export function encriptarTexto(texto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secretSesion()).digest(),
    iv,
  );
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return JSON.stringify({
    _mp: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    d: enc.toString("base64"),
  });
}

export function desencriptarTexto(texto: string) {
  try {
    const parsed = JSON.parse(texto) as {
      _mp?: number;
      iv?: string;
      tag?: string;
      d?: string;
    };
    if (parsed?._mp !== 1 || !parsed.iv || !parsed.tag || !parsed.d) {
      return texto;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      createHash("sha256").update(secretSesion()).digest(),
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parsed.d, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return texto;
  }
}
