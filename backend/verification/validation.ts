export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateIMEI(imei: string): void {
  if (!imei || typeof imei !== "string") {
    throw new ValidationError("IMEI is required and must be a string");
  }

  const cleanIMEI = imei.replace(/[\s-]/g, "");
  
  if (!/^\d{15}$/.test(cleanIMEI)) {
    throw new ValidationError("IMEI must be exactly 15 digits");
  }

  const digits = cleanIMEI.split("").map(Number);
  let sum = 0;
  
  for (let i = 0; i < 14; i++) {
    let digit = digits[i];
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== digits[14]) {
    throw new ValidationError("Invalid IMEI checksum");
  }
}

export function validateEmail(email: string): void {
  if (!email || typeof email !== "string") {
    throw new ValidationError("Email is required and must be a string");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format");
  }
}

export function validatePhoneNumber(phone: string): void {
  if (!phone || typeof phone !== "string") {
    throw new ValidationError("Phone number is required and must be a string");
  }

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
  
  if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
    throw new ValidationError("Phone number must be 10-15 digits, optionally starting with +");
  }
}

export function validateUUID(id: string, fieldName = "ID"): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
}

export function validateString(value: string, fieldName: string, minLength = 1, maxLength = 1000): void {
  if (!value || typeof value !== "string") {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
  }
}

export function validateNumber(value: number, fieldName: string, min?: number, max?: number): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }

  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
}

export function validateEnum<T extends string>(value: T, fieldName: string, allowedValues: readonly T[]): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(", ")}`);
  }
}

export function validateArray<T>(value: T[], fieldName: string, minLength = 0, maxLength = 1000): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must have at least ${minLength} items`);
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must have at most ${maxLength} items`);
  }
}

export function validateDate(value: Date | string, fieldName: string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }

  return date;
}

export function validateDateRange(start: Date | string, end: Date | string): void {
  const startDate = validateDate(start, "Start date");
  const endDate = validateDate(end, "End date");

  if (startDate > endDate) {
    throw new ValidationError("Start date must be before end date");
  }
}

export function validateURL(url: string, fieldName = "URL"): void {
  if (!url || typeof url !== "string") {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  try {
    new URL(url);
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`);
  }
}

export function validateDeviceStatus(status: string): void {
  const validStatuses = ["verified", "flagged", "reported", "stolen", "pending", "under_review"] as const;
  validateEnum(status, "Status", validStatuses);
}

export function validateTrustScore(score: number): void {
  validateNumber(score, "Trust score", 0, 100);
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "")
    .substring(0, 10000);
}

export function validatePagination(page?: number, limit?: number): { page: number; limit: number } {
  const validatedPage = page && page > 0 ? Math.floor(page) : 1;
  const validatedLimit = limit && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;

  return { page: validatedPage, limit: validatedLimit };
}
