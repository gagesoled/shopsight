
export function parseNumberValue(input: string): number | null {
  if (!input || typeof input !== "string") return null;

  // Remove commas, percent signs, whitespace
  const cleaned = input.replace(/,/g, "").replace(/%/g, "").trim();

  // Convert to float
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  // If original string had a %, convert to decimal
  return input.includes("%") ? parsed / 100 : parsed;
}
