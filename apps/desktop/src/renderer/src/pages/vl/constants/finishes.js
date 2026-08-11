// FILE: apps/desktop/src/renderer/src/constants/finishes.js
//
// Suggested finishes shown in Process UI.
// You can change this list later without touching processing/renaming logic.
//
// Notes:
// - Values should be stable identifiers (snake_case).
// - Labels are purely UI.

export const FINISHES = [
  "normal",
  "reverse_holo",
  "holo",
  "pokeball",
  "masterball",
  "cosmos",
  "etched",
  "ace_spec",
  "unknown",
];

export function finishLabel(finish) {
  const f = String(finish || "").trim();

  switch (f) {
    case "reverse_holo":
      return "Reverse Holo";
    case "pokeball":
      return "Poké Ball";
    case "masterball":
      return "Master Ball";
    case "holo":
      return "Holo";
    case "cosmos":
      return "Cosmos";
    case "etched":
      return "Etched";
    case "normal":
      return "Normal";
    case "ace_spec": 
      return "Ace Spec";
    case "unknown":
      return "Unknown";
    default:
      // fallback: prettify snake_case
      return f
        ? f
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Unknown";
  }
}