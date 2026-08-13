// Helpers de normalizacao usados tanto no preview de import de CSV
// (client, Dashboard.tsx) quanto na rota que persiste as linhas
// (server/routes.ts) - mantidos num so lugar para os dois nunca
// divergirem de novo.

/**
 * Converte uma string de valor monetario (BR ou US) para um numero em
 * "reais" (nao centavos). Detecta automaticamente se "," ou "." e o
 * separador decimal, olhando qual aparece por ultimo na string.
 */
export function parseMoneyString(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;

  let s = String(raw).replace(/[R$\s]/g, "").trim();
  if (!s) return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // Os dois aparecem: o ultimo e o separador decimal, o outro e milhar.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if (decimals !== 2) s = s.replace(/\./g, "");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Interpreta uma data de CSV ("dd/mm/yyyy" ou "yyyy-mm-dd") como data
 * LOCAL (nao UTC) para nao errar em +-1 dia por fuso horario. Retorna
 * null se nao conseguir interpretar.
 */
export function parseLooseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normaliza o tipo (entrada/saida) de uma linha de CSV, case/acento
 * insensitivo. Retorna null se nao reconhecer nada.
 */
export function normalizeCsvType(
  rawType: unknown,
  rawTipo: unknown
): "income" | "expense" | null {
  // Regex construida via new RegExp (em vez de um literal /.../ com os
  // caracteres de acento embutidos) para nao depender do encoding exato
  // do arquivo fonte e nao precisar da flag "u" (marcas de combinacao
  // diacritica, faixa Unicode U+0300-U+036F).
  const diacriticsRe = new RegExp("[\\u0300-\\u036f]", "g");
  const norm = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(diacriticsRe, "");

  const t = norm(rawType);
  const tipo = norm(rawTipo);

  if (t === "income" || ["entrada", "receita", "credito"].includes(tipo)) return "income";
  if (t === "expense" || ["saida", "despesa", "debito"].includes(tipo)) return "expense";
  return null;
}
