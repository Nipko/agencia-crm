export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_ERROR", details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function ensureObject(value, label = "El cuerpo de la solicitud") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} debe ser un objeto JSON.`, "INVALID_BODY");
  }
  return value;
}

export function stringField(
  body,
  key,
  { required = false, min = 0, max = 255, allowNull = false, normalize } = {}
) {
  const rawValue = body[key];
  if (rawValue === undefined) {
    if (required) {
      throw new HttpError(400, `El campo '${key}' es obligatorio.`, "VALIDATION_ERROR");
    }
    return undefined;
  }

  if (rawValue === null && allowNull) return null;
  if (typeof rawValue !== "string") {
    throw new HttpError(400, `El campo '${key}' debe ser texto.`, "VALIDATION_ERROR");
  }

  let value = rawValue.trim();
  if (normalize) value = normalize(value);

  if (value.length < min || value.length > max) {
    const range = min > 0 ? `entre ${min} y ${max}` : `máximo ${max}`;
    throw new HttpError(
      400,
      `El campo '${key}' debe tener ${range} caracteres.`,
      "VALIDATION_ERROR"
    );
  }

  return value;
}

export function identifierField(body, key, { required = false, max = 150 } = {}) {
  const value = stringField(body, key, {
    required,
    min: required ? 1 : 0,
    max,
    normalize: (item) => item.toLowerCase()
  });

  if (value !== undefined && !/^[^\s@]+(?:@[^\s@]+\.[^\s@]+)?$/.test(value)) {
    throw new HttpError(400, `El campo '${key}' no es válido.`, "VALIDATION_ERROR");
  }
  return value;
}

export function enumField(body, key, allowedValues, { required = false } = {}) {
  const value = stringField(body, key, { required, min: required ? 1 : 0, max: 50 });
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new HttpError(
      400,
      `El campo '${key}' debe ser uno de: ${allowedValues.join(", ")}.`,
      "VALIDATION_ERROR"
    );
  }
  return value;
}

export function numberField(
  body,
  key,
  { required = false, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}
) {
  const rawValue = body[key];
  if (rawValue === undefined) {
    if (required) {
      throw new HttpError(400, `El campo '${key}' es obligatorio.`, "VALIDATION_ERROR");
    }
    return undefined;
  }

  if (
    rawValue === null ||
    (typeof rawValue !== "number" && typeof rawValue !== "string") ||
    (typeof rawValue === "string" && rawValue.trim() === "")
  ) {
    throw new HttpError(400, `El campo '${key}' debe ser numérico.`, "VALIDATION_ERROR");
  }

  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(
      400,
      `El campo '${key}' debe ser un número entre ${min} y ${max}.`,
      "VALIDATION_ERROR"
    );
  }
  return value;
}

export function integerField(body, key, options = {}) {
  const value = numberField(body, key, options);
  if (value !== undefined && !Number.isInteger(value)) {
    throw new HttpError(400, `El campo '${key}' debe ser un entero.`, "VALIDATION_ERROR");
  }
  return value;
}

export function booleanField(body, key, { required = false } = {}) {
  const value = body[key];
  if (value === undefined) {
    if (required) {
      throw new HttpError(400, `El campo '${key}' es obligatorio.`, "VALIDATION_ERROR");
    }
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, `El campo '${key}' debe ser booleano.`, "VALIDATION_ERROR");
  }
  return value;
}

export function jsonObjectField(body, key, { required = false, allowNull = true } = {}) {
  const value = body[key];
  if (value === undefined) {
    if (required) {
      throw new HttpError(400, `El campo '${key}' es obligatorio.`, "VALIDATION_ERROR");
    }
    return undefined;
  }
  if (value === null && allowNull) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `El campo '${key}' debe ser un objeto.`, "VALIDATION_ERROR");
  }
  return value;
}

export function arrayField(body, key, { required = false, max = 100 } = {}) {
  const value = body[key];
  if (value === undefined) {
    if (required) {
      throw new HttpError(400, `El campo '${key}' es obligatorio.`, "VALIDATION_ERROR");
    }
    return undefined;
  }
  if (!Array.isArray(value) || value.length > max) {
    throw new HttpError(
      400,
      `El campo '${key}' debe ser una lista de máximo ${max} elementos.`,
      "VALIDATION_ERROR"
    );
  }
  return value;
}

export function dateField(body, key, { required = false, allowNull = true } = {}) {
  const value = stringField(body, key, { required, min: required ? 10 : 0, max: 10, allowNull });
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `El campo '${key}' debe usar el formato AAAA-MM-DD.`, "VALIDATION_ERROR");
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `El campo '${key}' contiene una fecha inválida.`, "VALIDATION_ERROR");
  }
  return value;
}

export function urlField(body, key, { required = false, allowNull = true } = {}) {
  const value = stringField(body, key, {
    required,
    min: required ? 1 : 0,
    max: 2_048,
    allowNull
  });
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  try {
    const parsedUrl = new URL(value);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("unsupported protocol");
  } catch {
    throw new HttpError(400, `El campo '${key}' debe ser una URL HTTP(S) válida.`, "VALIDATION_ERROR");
  }
  return value;
}

export function colorField(body, key, { required = false } = {}) {
  const value = stringField(body, key, { required, min: required ? 4 : 0, max: 9 });
  if (value !== undefined && !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(value)) {
    throw new HttpError(400, `El campo '${key}' debe ser un color hexadecimal.`, "VALIDATION_ERROR");
  }
  return value;
}

export function idParameter(value, label = "id") {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$/.test(value)) {
    throw new HttpError(400, `El parámetro '${label}' no es válido.`, "VALIDATION_ERROR");
  }
  return value;
}

export function assertPassword(password, key = "newPassword") {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new HttpError(
      400,
      `El campo '${key}' debe tener entre 10 y 72 bytes.`,
      "WEAK_PASSWORD"
    );
  }
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(
      400,
      `El campo '${key}' debe incluir al menos una letra y un número.`,
      "WEAK_PASSWORD"
    );
  }
  return password;
}

export function assertHasUpdates(updates) {
  if (Object.values(updates).every((value) => value === undefined)) {
    throw new HttpError(400, "No se enviaron campos para actualizar.", "VALIDATION_ERROR");
  }
}
