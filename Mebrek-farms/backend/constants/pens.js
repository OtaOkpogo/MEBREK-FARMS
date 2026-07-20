// Single source of truth for pen/house names across the entire backend.
// Import this everywhere a model or controller needs the pen list,
// instead of maintaining separate copies per module (Production,
// Vaccination, Medication, Mortality, BirdHealth, Feed, Water,
// Inventory, etc.) — that duplication is what let "battery cage" and
// "pen" slip through as valid-looking values in modules whose schema
// never actually enforced the real enum.

const PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Deep Litter Pen 4",
  "Deep Litter Pen 5",
  "Sick Bay",
  "Pen 150",
];

module.exports = PENS;
