export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function objectBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "A JSON object is required.");
  return value;
}

export function text(value, name, { min = 0, max = 1000, optional = false } = {}) {
  if (value == null && optional) return "";
  if (typeof value !== "string") throw new HttpError(400, `${name} must be text.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new HttpError(400, `${name} must be between ${min} and ${max} characters.`);
  return result;
}

export function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function money(value, name) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, `${name} must be a non-negative amount.`);
  return Math.round(amount * 100) / 100;
}

export function imageHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
