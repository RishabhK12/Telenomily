export const LAPTOP_SCENES = [
  "discharge",
  "check-lisinopril",
  "check-ibuprofen",
  "check-vitamin",
  "check-unreadable",
  "check-pill",
  "check-foreign",
  "finish-cabinet",
  "obtain-cephalexin",
  "pharmacy",
  "reminder",
] as const;

export type LaptopScene = (typeof LAPTOP_SCENES)[number];

export const MEDICINE_SCENES = [
  "check-lisinopril",
  "check-ibuprofen",
  "check-vitamin",
  "check-unreadable",
  "check-pill",
  "check-foreign",
] as const satisfies readonly LaptopScene[];

export const SCENE_TITLE: Record<LaptopScene, string> = {
  discharge: "Demo simulation: discharge sheet reviewed",
  "check-lisinopril": "Demo simulation: lisinopril label checked",
  "check-ibuprofen": "Demo simulation: ibuprofen label checked",
  "check-vitamin": "Demo simulation: expired vitamin checked",
  "check-unreadable": "Demo simulation: unreadable label checked",
  "check-pill": "Demo simulation: pill compared",
  "check-foreign": "Demo simulation: foreign label checked",
  "finish-cabinet": "Demo simulation: cabinet scan finished",
  "obtain-cephalexin": "Demo simulation: obtain cephalexin",
  pharmacy: "Demo simulation: pharmacy statement",
  reminder: "Demo simulation: reminder script",
};

export const SCENE_LABEL: Record<LaptopScene, string> = {
  discharge: "Review the hospital sheet",
  "check-lisinopril": "Show lisinopril",
  "check-ibuprofen": "Show ibuprofen",
  "check-vitamin": "Show expired vitamin",
  "check-unreadable": "Show unreadable label",
  "check-pill": "Show pill",
  "check-foreign": "Show foreign box",
  "finish-cabinet": "Finish cabinet",
  "obtain-cephalexin": "I need to obtain cephalexin",
  pharmacy: "Run pharmacy",
  reminder: "Run reminder",
};

export const SCENE_IMAGE: Record<LaptopScene, string | null> = {
  discharge: null,
  "check-lisinopril": "/fixtures/lisinopril.svg",
  "check-ibuprofen": "/fixtures/ibuprofen.svg",
  "check-vitamin": "/fixtures/vitamin-d-expired.svg",
  "check-unreadable": "/fixtures/unreadable.svg",
  "check-pill": "/fixtures/pill-nc-10.svg",
  "check-foreign": "/fixtures/paracetamol-sol.svg",
  "finish-cabinet": null,
  "obtain-cephalexin": null,
  pharmacy: null,
  reminder: null,
};

export const SCENE_ALT: Record<LaptopScene, string> = {
  discharge: "",
  "check-lisinopril": "Illustrative drawing of a lisinopril package",
  "check-ibuprofen": "Illustrative drawing of an ibuprofen package",
  "check-vitamin": "Illustrative drawing of an expired vitamin D package",
  "check-unreadable": "Illustrative drawing of a blurry label",
  "check-pill": "Illustrative drawing of a round white pill marked NC 10",
  "check-foreign": "Illustrative drawing of a Spanish Paracetamol Sol box",
  "finish-cabinet": "",
  "obtain-cephalexin": "",
  pharmacy: "",
  reminder: "",
};

export function isLaptopScene(value: string): value is LaptopScene {
  return (LAPTOP_SCENES as readonly string[]).includes(value);
}
