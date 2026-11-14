export type Lang = 'bn' | 'en';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Converts ASCII digits to Bangla digits for display. The API always uses ASCII. */
export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Formats a taka amount with South Asian grouping, e.g. 1860 -> "৳১,৮৬০" in Bangla. */
export function formatTaka(amount: number, lang: Lang = 'bn'): string {
  const rounded = Math.round(amount);
  const grouped = rounded.toLocaleString('en-IN');
  return '৳' + (lang === 'bn' ? toBanglaDigits(grouped) : grouped);
}

/** Formats kilograms with at most one decimal, e.g. 17.5 -> "১৭.৫ কেজি". */
export function formatKg(kg: number, lang: Lang = 'bn'): string {
  const text = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
  return lang === 'bn' ? `${toBanglaDigits(text)} কেজি` : `${text} kg`;
}

export const strings = {
  bn: {
    appName: 'ভাঙ্গারিওয়ালা',
    tagline: 'ন্যায্য দর, সঠিক ওজন',
    serverOk: 'সার্ভারের সাথে সংযোগ আছে',
    serverDown: 'সার্ভারে সংযোগ হচ্ছে না',
    checking: 'যাচাই করা হচ্ছে…',
  },
  en: {
    appName: 'BhangariWala',
    tagline: 'Fair rates, honest weight',
    serverOk: 'Connected to the server',
    serverDown: 'Cannot reach the server',
    checking: 'Checking…',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof strings)['bn'];

export function t(key: StringKey, lang: Lang = 'bn'): string {
  return strings[lang][key];
}
