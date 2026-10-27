export interface ContactCardFields {
  name: string;
  company: string;
  role: string;
  phone: string;
  email: string;
}

export interface ContactCardView {
  name: string;
  company: string;
  /** A company named in the role when it is not the same as the company field. */
  roleCompany: string;
  role: string;
  address: string;
  note: string;
  phone: string;
  email: string;
}

const STREET =
  /\b(?:street|st|road|rd|avenue|ave|suite|bldg|building|drive|dr|lane|ln|blvd|boulevard|way|floor|circle|court|ct)\b/i;

/** Turn a stored contact into display lines. The saved fields are not rewritten. */
export function presentContact(contact: ContactCardFields): ContactCardView {
  const parsed = parseRole(contact.role);
  const storedCompany = contact.company.trim();
  const sameCompany = storedCompany.toLowerCase() === parsed.company.toLowerCase();
  return {
    name: contact.name.trim() || "Unnamed",
    company: storedCompany || parsed.company,
    roleCompany: storedCompany && parsed.company && !sameCompany ? parsed.company : "",
    role: parsed.role,
    address: parsed.address,
    note: parsed.note,
    phone: contact.phone.trim(),
    email: contact.email.trim(),
  };
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function parseRole(raw: string): { role: string; company: string; address: string; note: string } {
  const notes: string[] = [];
  const addresses: string[] = [];
  let text = raw.replace(/\(([^)]*)\)/g, (_full, inner: string) => {
    const value = inner.trim();
    if (!value) return "";
    if (isNote(value)) {
      notes.push(value);
      return "";
    }
    if (isAddress(value)) {
      addresses.push(value);
      return "";
    }
    return ` (${value}) `;
  });

  text = cleanup(text);
  let role = text;
  let company = "";
  const split = text.split(/\s+-\s+/);
  if (split.length >= 2) {
    role = cleanup(split[0] ?? "");
    const rest = cleanup(split.slice(1).join(" - "));
    if (isNote(rest)) {
      notes.push(rest);
    } else {
      const parts = splitCompanyAddress(rest);
      company = parts.company;
      if (parts.address) addresses.push(parts.address);
      if (!parts.company && !parts.address && rest) role = cleanup(`${role} - ${rest}`);
    }
  }

  return {
    role: cleanup(role),
    company,
    address: addresses.join("; "),
    note: notes.join(" "),
  };
}

function splitCompanyAddress(value: string): { company: string; address: string } {
  const match = /^(.*?)(?:,\s+)?(\d+\s+.+)$/.exec(value);
  if (!match) return { company: value, address: "" };
  const address = cleanup(match[2] ?? "");
  if (!isAddress(address) && !isAddress(value)) return { company: value, address: "" };
  return { company: cleanup(match[1] ?? ""), address: address || value };
}

function isNote(value: string): boolean {
  return /^(?:per|note|see|addendum|issue)\b/i.test(value) || /\bverify\b/i.test(value);
}

function isAddress(value: string): boolean {
  if (/\b\d{5}(?:-\d{4})?\b/.test(value)) return true;
  return /\d/.test(value) && STREET.test(value);
}

function cleanup(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
}
