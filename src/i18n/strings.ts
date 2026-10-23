import type { FormDefinition } from "../definition/schema";

export type Lang = FormDefinition["lang"];
export type Address = FormDefinition["address"];

export type StringKey =
  | "required" | "invalidEmail" | "number" | "min" | "max" | "maxLength" | "chooseOne"
  | "next" | "back" | "submit" | "stepOf" | "errorSummary" | "draftRestored"
  | "yes" | "no" | "optional" | "sending" | "notFound";

// A tuple is [formal, informal]; a plain string serves both.
type Entry = string | readonly [string, string];

const N = "\u202f"; // narrow non-breaking space, French rule before : ; ! ?

const strings: Record<Lang, Record<StringKey, Entry>> = {
  fr: {
    required: "Ce champ est requis.",
    invalidEmail: ["Vérifiez votre adresse email.", "Vérifie ton adresse email."],
    number: ["Saisissez un nombre.", "Saisis un nombre."],
    min: "La valeur minimale est {min}.",
    max: "La valeur maximale est {max}.",
    maxLength: "{max} caractères au maximum.",
    chooseOne: ["Choisissez une réponse valide.", "Choisis une réponse valide."],
    next: "Suivant",
    back: "Retour",
    submit: "Envoyer",
    stepOf: "Étape {current} sur {total}",
    errorSummary: [`Corrigez les champs suivants${N}:`, `Corrige les champs suivants${N}:`],
    draftRestored: ["Votre brouillon a été restauré.", "Ton brouillon a été restauré."],
    yes: "Oui",
    no: "Non",
    optional: "facultatif",
    sending: "Envoi en cours…",
    notFound: "Ce formulaire n’existe pas.",
  },
  en: {
    required: "This field is required.",
    invalidEmail: "Check your email address.",
    number: "Enter a number.",
    min: "The minimum value is {min}.",
    max: "The maximum value is {max}.",
    maxLength: "{max} characters at most.",
    chooseOne: "Choose a valid answer.",
    next: "Next",
    back: "Back",
    submit: "Send",
    stepOf: "Step {current} of {total}",
    errorSummary: "Fix the following fields:",
    draftRestored: "Your draft was restored.",
    yes: "Yes",
    no: "No",
    optional: "optional",
    sending: "Sending…",
    notFound: "This form does not exist.",
  },
  de: {
    required: "Dieses Feld ist erforderlich.",
    invalidEmail: ["Prüfen Sie Ihre E-Mail-Adresse.", "Prüfe deine E-Mail-Adresse."],
    number: ["Geben Sie eine Zahl ein.", "Gib eine Zahl ein."],
    min: "Der Mindestwert ist {min}.",
    max: "Der Höchstwert ist {max}.",
    maxLength: "Höchstens {max} Zeichen.",
    chooseOne: ["Wählen Sie eine gültige Antwort.", "Wähle eine gültige Antwort."],
    next: "Weiter",
    back: "Zurück",
    submit: "Senden",
    stepOf: "Schritt {current} von {total}",
    errorSummary: ["Korrigieren Sie diese Felder:", "Korrigiere diese Felder:"],
    draftRestored: ["Ihr Entwurf wurde wiederhergestellt.", "Dein Entwurf wurde wiederhergestellt."],
    yes: "Ja",
    no: "Nein",
    optional: "optional",
    sending: "Wird gesendet…",
    notFound: "Dieses Formular existiert nicht.",
  },
  th: {
    required: "กรุณากรอกข้อมูลในช่องนี้",
    invalidEmail: "ตรวจสอบที่อยู่อีเมล",
    number: "กรอกเป็นตัวเลข",
    min: "ค่าต่ำสุดคือ {min}",
    max: "ค่าสูงสุดคือ {max}",
    maxLength: "ไม่เกิน {max} ตัวอักษร",
    chooseOne: "เลือกคำตอบที่ถูกต้อง",
    next: "ถัดไป",
    back: "กลับ",
    submit: "ส่ง",
    stepOf: "ขั้นตอนที่ {current} จาก {total}",
    errorSummary: "แก้ไขช่องต่อไปนี้",
    draftRestored: "กู้คืนฉบับร่างของคุณแล้ว",
    yes: "ใช่",
    no: "ไม่ใช่",
    optional: "ไม่บังคับ",
    sending: "กำลังส่ง…",
    notFound: "ไม่พบแบบฟอร์มนี้",
  },
};

export function t(lang: Lang, address: Address, key: StringKey, vars: Record<string, string | number> = {}): string {
  const e = strings[lang][key];
  const s = typeof e === "string" ? e : e[address === "formal" ? 0 : 1];
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
