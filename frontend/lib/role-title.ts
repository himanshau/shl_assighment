/** Build a short card title from the user's hiring message. */
export function roleTitleFromMessage(message: string): string {
  const cleaned = message
    .replace(/^[\s,.:;]+/, "")
    .replace(/\b(and one more thing|also|i need|i want|an assistant in|assistant in)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Hiring request";

  const lower = cleaned.toLowerCase();
  const seniority =
    ["senior", "junior", "mid-level", "mid level", "entry-level", "entry level"].find(
      (s) => lower.includes(s),
    ) ?? "";
  const tech =
    ["python", "java", "javascript", "react", "angular", ".net", "c#"].find((s) =>
      lower.includes(s),
    ) ?? "";

  const roleWord = lower.includes("developer")
    ? "Developer"
    : lower.includes("manager")
      ? "Manager"
      : lower.includes("engineer")
        ? "Engineer"
        : lower.includes("analyst")
          ? "Analyst"
          : "Role";

  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

  if (seniority && tech) {
    return `${cap(seniority)} ${cap(tech)} ${roleWord}`;
  }
  if (tech) {
    return `${cap(tech)} ${roleWord}`;
  }

  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69)}…`;
}
