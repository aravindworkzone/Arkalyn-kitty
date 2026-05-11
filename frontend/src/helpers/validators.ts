export type ValidationResult = { valid: boolean; message: string };

const ok = (): ValidationResult => ({ valid: true, message: "" });
const fail = (message: string): ValidationResult => ({ valid: false, message });

export const MAX_AMOUNT = 1_000_000;

// ── Auth ──────────────────────────────────────────────────────────

export const validateEmail = (email: string): ValidationResult => {
  if (!email?.trim()) return fail("Email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return fail("Invalid email format");
  return ok();
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) return fail("Password is required");
  if (password.length < 6) return fail("Password must be at least 6 characters");
  if (password.length > 128) return fail("Password must be at most 128 characters");
  return ok();
};

export const validateName = (name: string): ValidationResult => {
  if (!name?.trim()) return fail("Name is required");
  if (name.trim().length < 4) return fail("Name must be at least 4 characters");
  if (name.trim().length > 50) return fail("Name must be at most 50 characters");
  return ok();
};

// ── Group ─────────────────────────────────────────────────────────

export const validateGroupName = (name: string): ValidationResult => {
  if (!name?.trim()) return fail("Group name is required");
  if (name.trim().length < 3) return fail("Group name must be at least 3 characters");
  if (name.trim().length > 30) return fail("Group name must be at most 30 characters");
  if (!/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(name.trim()))
    return fail("Group name can only contain letters, numbers, and single spaces");
  return ok();
};

export const validateDescription = (description: string): ValidationResult => {
  if (!description?.trim()) return fail("Group description is required");
  if (description.trim().length < 3) return fail("Group description must be at least 3 characters");
  if (description.trim().length > 100) return fail("Group description must be at most 100 characters");
  return ok();
};

// ── Category ──────────────────────────────────────────────────────

export const validateCategoryName = (name: string): ValidationResult => {
  if (!name?.trim()) return fail("Category name is required");
  if (name.trim().length < 3) return fail("Category name must be at least 3 characters");
  if (name.trim().length > 40) return fail("Category name must be at most 40 characters");
  return ok();
};

// ── Expense ───────────────────────────────────────────────────────

export const validateTitle = (title: string): ValidationResult => {
  if (!title?.trim()) return fail("Title is required");
  if (title.trim().length < 3) return fail("Title must be at least 3 characters");
  if (title.trim().length > 100) return fail("Title must be at most 100 characters");
  return ok();
};

export const validateDate = (date: string): ValidationResult => {
  if (!date) return fail("Date is required");
  const d = new Date(date);
  if (isNaN(d.getTime())) return fail("Invalid date");
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return fail("Date cannot be in the future");
  return ok();
};

// ── Money ─────────────────────────────────────────────────────────

export const validateAmount = (
  value: string | number,
  max: number = MAX_AMOUNT,
): ValidationResult => {
  const num = typeof value === "string" ? Number(value) : value;
  if (!value && value !== 0) return fail("Amount is required");
  if (isNaN(num) || num <= 0) return fail("Amount must be a positive number");
  if (num > max)
    return fail(`Amount cannot exceed ₹${max.toLocaleString("en-IN")}`);
  return ok();
};

export const validateContribution = (value: string | number): ValidationResult => {
  const num = typeof value === "string" ? Number(value) : value;
  if (value === "" || value === null || value === undefined)
    return fail("Contribution is required");
  if (isNaN(num) || num < 0) return fail("Contribution must be 0 or more");
  if (num > MAX_AMOUNT)
    return fail(`Contribution cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN")}`);
  return ok();
};

// ── Input sanitizers for onChange handlers (mobile-safe) ──────────

// Returns a cleaned numeric string — use in onChange for amount fields.
// Pass `max` to clamp the value to a context-specific ceiling (e.g. group balance).
export const sanitizeAmount = (raw: string, max: number = MAX_AMOUNT): string => {
  let v = raw.replace(/\D/g, "");
  if (Number(v) >= max) v = String(max);
  if (v[0] === "0") v = v.slice(1);
  if (Number(v) === 0) v = "";
  return v;
};

// Returns a cleaned group-name string — use in onChange for name field.
export const sanitizeGroupName = (raw: string): string =>
  raw.replace(/[^A-Za-z0-9 ]/g, "").replace(/ {2,}/g, " ").slice(0, 30);

// Legacy event-handler form — kept for any remaining onInput usages.
export const handleAmountInput = (e: React.FormEvent<HTMLInputElement>): void => {
  e.currentTarget.value = sanitizeAmount(e.currentTarget.value);
};

// ── Grouped validators (used by auth handler form iteration) ──────

export const validators = {
  email: validateEmail,
  password: validatePassword,
  name: validateName,
};
