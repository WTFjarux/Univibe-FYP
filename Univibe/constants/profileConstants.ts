// app/constants/profileConstants.ts

export const GRADUATION_YEARS = Array.from({ length: 10 }, (_, i) =>
  String(new Date().getFullYear() + i)
);

export const MAJORS = [
  {
    id: "bit",
    label: "Bachelor in Information Technology (BIT)",
    value: "Bachelor in Information Technology (BIT)",
  },
  {
    id: "cs",
    label: "Bachelor in Cyber Security",
    value: "Bachelor in Cyber Security",
  },
  {
    id: "ibm",
    label: "Bachelor in International Business Management (BBIM)",
    value: "Bachelor in International Business Management (BBIM)",
  },
  {
    id: "mba",
    label: "Master in Business Administration (MBA)",
    value: "Master in Business Administration (MBA)",
  },
];

export const YEARS = [
  { id: "upc", label: "UPC", value: "UPC" },
  { id: "first", label: "First Year", value: "First" },
  { id: "second", label: "Second Year", value: "Second" },
  { id: "third", label: "Third Year", value: "Third" },
];

export const COLLEGES = [
  "Herald College Kathmandu",
  "Kathmandu University",
  "Tribhuvan University",
  "Pokhara University",
  "Purbanchal University",
];