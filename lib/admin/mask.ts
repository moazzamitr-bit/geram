export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const d = phone.replace(/\s/g, "");
  if (d.length < 6) return "•••";
  return `${d.slice(0, 4)}•••${d.slice(-2)}`;
}

export function maskEmail(email: string | null | undefined) {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "•••";
  const head = u.slice(0, 2);
  return `${head}•••@${d}`;
}

export function maskIban(iban: string | null | undefined) {
  if (!iban) return "—";
  const compact = iban.replace(/\s/g, "");
  if (compact.length < 8) return "IR••••";
  return `${compact.slice(0, 4)}••••${compact.slice(-4)}`;
}

export function ibanLast4(iban: string | null | undefined) {
  if (!iban) return "";
  return iban.replace(/\s/g, "").slice(-4);
}

export function shortId(id: string | null | undefined) {
  if (!id) return "—";
  return id.slice(0, 8);
}
