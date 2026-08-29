const WHATSAPP_E164 = "5493417458893";

function encodeMessage(text: string) {
  return encodeURIComponent(text.trim());
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeMessage(message)}`;
}

export function whatsappATelefono(telefono: string, message = "") {
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 8) return null;
  let n = digits.replace(/^0+/, "");
  if (!n.startsWith("54")) n = n.startsWith("9") ? `54${n}` : `549${n}`;
  return message
    ? `https://wa.me/${n}?text=${encodeMessage(message)}`
    : `https://wa.me/${n}`;
}

export function whatsappPhoneDisplay() {
  return "+54 9 341 745-8893";
}
