// Lightweight i18n. No external libraries.
// Auto-detects locale from navigator.language; falls back to 'uk'.
// Add a new language by extending the `dict` object below.

import { useState, useEffect, createContext, useContext } from 'react';
import { getItem, setItem } from './storage';

const LOCALE_KEY = 'locale';
const SUPPORTED = ['uk', 'en'];
const DEFAULT_LOCALE = 'uk';

// Detect best matching locale from system. Falls back to 'uk'.
function detectLocale() {
  // 1) Stored override (we won't use it now since we picked auto-only,
  //    but it's here so we can flip to manual later without rewriting).
  const stored = getItem(LOCALE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;

  // 2) System languages (navigator.languages is array, navigator.language is single)
  const candidates = (navigator.languages || [navigator.language || '']).map(l =>
    String(l).toLowerCase().split('-')[0]
  );
  for (const c of candidates) {
    if (SUPPORTED.includes(c)) return c;
  }
  return DEFAULT_LOCALE;
}

// ====== STRINGS ======
// Use `t('some.key')` — dot-paths into the tree.
// For interpolation use `t('foo', { name: 'X' })` and `{name}` in the value.

const dict = {
  uk: {
    appName: 'Sobrius',
    appTagline: 'Контроль алкоголю',
    loading: 'Завантаження…',

    // Status badges
    status: {
      sober: 'Тверезий',
      ok: 'Можна за кермо',
      noDrive: 'Не сідай за кермо',
      danger: 'Небезпечний рівень'
    },

    // Hero card
    hero: {
      currentLevel: 'Поточний рівень',
      legalLimit: 'Дозволена межа',
      canDrive: 'Можна за кермо',
      canDriveIn: 'через {dur} · {time}',
      canDriveNow: 'зараз ✓'
    },

    // Weekly tracker
    weekly: {
      title: 'Тижнева норма',
      bandSober: 'Тиждень без алкоголю',
      bandLow: 'У межах низького ризику',
      bandIncreasing: 'Підвищений ризик',
      bandHigh: 'Високий ризик',
      ofLimit: 'від норми',
      lastSevenDays: 'за останні 7 днів · {units} од. з 14',
      norm: '{g} г · норма',
      dryDays: 'Сухих днів',
      ofSeven: 'з 7',
      biggestDay: 'Найбільший день',
      tooMuch: '⚠ багато',
      withinSafe: '< {g} г ок',
      riskDays: 'Днів з ризиком',
      bingeShort: 'binge',
      noBinge: 'нема',
      hintAllOneDay: 'Все за один день — спробуйте розподілити',
      hintGoodSpread: 'Розподілено на {n} дні — добре',
      hintNoDryDays: 'Жодного «сухого» дня цього тижня',
      explainP1: '<strong>UK Chief Medical Officers</strong> рекомендують не більше <strong>14 одиниць</strong> алкоголю на тиждень (≈112 г чистого спирту), однаково для чоловіків і жінок.',
      explainP2: 'Краще розподілити на <strong>3 і більше дні</strong>, з кількома днями повністю без алкоголю. Уникати <strong>надмірного споживання за один раз</strong> (понад {threshold} г для {gender}).',
      explainP3: '1 одиниця = 8 г чистого етанолу = пів пінти пива 4% / маленький келих вина 12% / 25 мл міцного 40%.',
      genderMen: 'чоловіків',
      genderWomen: 'жінок'
    },

    // Forecast chart
    chart: {
      title: 'Прогноз на сьогодні',
      realtime: 'в реальному часі',
      bacLevel: 'Рівень BAC',
      legalLimit: 'Дозволена межа',
      canDrive: 'Можна за кермо'
    },

    // Add drink
    add: {
      title: 'Додати напій',
      other: 'Інший',
      ownDrink: 'свій напій',
      hintRemovePreset: 'Утримуйте свій напій, щоб видалити з пресетів',
      hintClock: 'Натисніть на 🕐 у куточку напою, щоб обрати дату й час'
    },

    // Stats
    stats: {
      title: 'Статистика',
      day: 'День',
      month: 'Місяць',
      year: 'Рік',
      drinks: 'Напоїв',
      volumeMl: "Об'єм, мл",
      alcoholG: 'Спирт, г',
      dryDays: 'Сухих днів',
      withDrinks: 'З напоями',
      avgPerDay: 'Середнє/день',
      ukNorm: 'UK CMO норма (низький ризик): {limit} г за {period}',
      periodMonth: 'місяць',
      periodYear: 'рік',
      ethanolByDay: 'Чистий етанол по днях (г) — натисніть стовпець для деталей',
      drinkList: 'Список напоїв',
      emptyDay: 'Сьогодні нічого не випито',
      emptyMonth: 'Цього місяця нічого не випито',
      emptyYear: 'Цього року нічого не випито',
      timeline: 'Хронологія',
      back: 'Назад',
      gOfAlc: 'г спирту',
      tapToEdit: 'Натисніть на напій, щоб відредагувати'
    },

    // Drink count plurals: 1 напій / 2-4 напої / 5+ напоїв
    drinkCount: { one: 'напій', few: 'напої', many: 'напоїв' },

    // Profile
    profile: {
      tellAboutYou: 'Розкажіть про себе',
      title: 'Профіль',
      reason: 'Дані потрібні для точного розрахунку',
      gender: 'Стать',
      male: 'Чоловік',
      female: 'Жінка',
      weight: 'Вага · {w} кг',
      weightMin: '40',
      weightMax: '150 кг',
      legalLimit: 'Дозволена межа',
      countryHint: 'Норми відрізняються за країнами: Україна — 0.2 ‰, ЄС — переважно 0.5 ‰, Мальта — 0.8 ‰.',
      save: 'Зберегти'
    },

    // Custom drink modal
    custom: {
      title: 'Свій напій',
      icon: 'Іконка',
      name: 'Назва',
      defaultName: 'Напій',
      volume: "Об'єм · {v} мл",
      strength: 'Міцність · {p}%',
      whenJustNow: 'Випито: щойно',
      when: 'Випито: {ago} тому',
      pureAlcohol: 'Чистий спирт',
      savePreset: 'Зберегти як пресет для швидкого додавання',
      add: 'Додати'
    },

    // Edit drink modal
    edit: {
      title: 'Редагувати напій',
      save: 'Зберегти зміни',
      delete: 'Видалити'
    },

    // Time picker
    time: {
      title: 'Коли випито?',
      addToJournal: 'Додати в щоденник',
      now: 'Зараз',
      m30: '30 хв тому',
      h2: '2 год тому',
      yesterday20: 'Вчора 20:00',
      weekAgo: 'Тиждень тому',
      // For "X хв тому", "X год тому" etc.
      relJustNow: 'щойно',
      relMinAgo: '{n} хв тому',
      relHourAgo: '{n} год тому · {time}',
      relYesterday: 'вчора · {time}',
      relDaysAgo: '{n} дн тому · {time}',
      relInFuture: 'у майбутньому · {time}'
    },

    // Consent screen
    consent: {
      title: 'Перш ніж почати',
      subtitle: 'Будь ласка, прочитайте уважно',
      adultOnly: '<strong>Лише для повнолітніх (18+).</strong> Цей застосунок не призначений для неповнолітніх.',
      estimateOnly: '<strong>Це оцінка, а не вимірювання.</strong> Розрахунок робиться за формулою Відмарка на базі ваших даних і журналу напоїв. Реальний рівень алкоголю в крові залежить від багатьох індивідуальних факторів і може суттєво відрізнятися.',
      notForDriving: '<strong>Не для рішень про водіння.</strong> Жоден програмний калькулятор не замінює сертифікований алкотестер чи аналіз крові. Ніколи не сідайте за кермо, спираючись лише на цю оцінку.',
      acceptHint: 'Натискаючи «Розумію та погоджуюсь», ви підтверджуєте, що вам виповнилось 18 років, і ви усвідомлюєте обмеження точності цього застосунку.',
      accept: 'Розумію та погоджуюсь'
    },

    // Footer
    footer1: 'Розрахунки за формулою Відмарка — це наближена оцінка. Індивідуальні фактори (їжа, ліки, здоров\'я, темп пиття) можуть суттєво змінити реальний рівень.',
    footer2: 'Цей застосунок не може замінити справжній алкотестер чи аналіз крові.',
    footer3: 'Ніколи не покладайтесь на калькулятор для рішення сідати за кермо.',

    // Built-in drink presets
    presets: {
      beerLight: 'Пиво світле',
      beerStrong: 'Пиво міцне',
      wine: 'Вино',
      champagne: 'Шампанське',
      vodka: 'Горілка',
      whiskey: 'Віскі',
      cocktail: 'Коктейль'
    },

    // Confirmations
    confirm: {
      removePreset: 'Видалити "{name}" з пресетів?'
    }
  },

  en: {
    appName: 'Sobrius',
    appTagline: 'Alcohol tracker',
    loading: 'Loading…',

    status: {
      sober: 'Sober',
      ok: 'Safe to drive',
      noDrive: "Don't drive",
      danger: 'Dangerous level'
    },

    hero: {
      currentLevel: 'Current level',
      legalLimit: 'Legal limit',
      canDrive: 'Safe to drive',
      canDriveIn: 'in {dur} · {time}',
      canDriveNow: 'now ✓'
    },

    weekly: {
      title: 'Weekly limit',
      bandSober: 'Alcohol-free week',
      bandLow: 'Within low-risk range',
      bandIncreasing: 'Increasing risk',
      bandHigh: 'High risk',
      ofLimit: 'of limit',
      lastSevenDays: 'last 7 days · {units} of 14 units',
      norm: '{g} g · limit',
      dryDays: 'Dry days',
      ofSeven: 'of 7',
      biggestDay: 'Biggest day',
      tooMuch: '⚠ too much',
      withinSafe: '< {g} g ok',
      riskDays: 'Risk days',
      bingeShort: 'binge',
      noBinge: 'none',
      hintAllOneDay: 'All in one day — try spreading it out',
      hintGoodSpread: 'Spread across {n} days — good',
      hintNoDryDays: 'No dry days this week',
      explainP1: '<strong>UK Chief Medical Officers</strong> recommend no more than <strong>14 units</strong> of alcohol per week (~112 g pure alcohol), the same for men and women.',
      explainP2: "It's best to spread this across <strong>3 or more days</strong>, with several drink-free days. Avoid <strong>heavy single-occasion drinking</strong> (over {threshold} g for {gender}).",
      explainP3: '1 unit = 8 g of pure ethanol = half a pint of 4% beer / small glass of 12% wine / 25 ml of 40% spirit.',
      genderMen: 'men',
      genderWomen: 'women'
    },

    chart: {
      title: "Today's forecast",
      realtime: 'real-time',
      bacLevel: 'BAC level',
      legalLimit: 'Legal limit',
      canDrive: 'Safe to drive'
    },

    add: {
      title: 'Add a drink',
      other: 'Other',
      ownDrink: 'custom drink',
      hintRemovePreset: 'Long-press a custom drink to remove from presets',
      hintClock: 'Tap 🕐 in the corner of a drink to choose date & time'
    },

    stats: {
      title: 'Statistics',
      day: 'Day',
      month: 'Month',
      year: 'Year',
      drinks: 'Drinks',
      volumeMl: 'Volume, ml',
      alcoholG: 'Alcohol, g',
      dryDays: 'Dry days',
      withDrinks: 'With drinks',
      avgPerDay: 'Avg/day',
      ukNorm: 'UK CMO low-risk limit: {limit} g per {period}',
      periodMonth: 'month',
      periodYear: 'year',
      ethanolByDay: 'Pure ethanol by day (g) — tap a bar for details',
      drinkList: 'Drinks list',
      emptyDay: 'Nothing today',
      emptyMonth: 'Nothing this month',
      emptyYear: 'Nothing this year',
      timeline: 'Timeline',
      back: 'Back',
      gOfAlc: 'g of alcohol',
      tapToEdit: 'Tap a drink to edit'
    },

    drinkCount: { one: 'drink', few: 'drinks', many: 'drinks' },

    profile: {
      tellAboutYou: 'Tell us about yourself',
      title: 'Profile',
      reason: 'These help us calculate accurately',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      weight: 'Weight · {w} kg',
      weightMin: '40',
      weightMax: '150 kg',
      legalLimit: 'Legal limit',
      countryHint: 'Limits vary by country: UK — 0.8 ‰, EU — typically 0.5 ‰, Ukraine — 0.2 ‰.',
      save: 'Save'
    },

    custom: {
      title: 'Custom drink',
      icon: 'Icon',
      name: 'Name',
      defaultName: 'Drink',
      volume: 'Volume · {v} ml',
      strength: 'Strength · {p}%',
      whenJustNow: 'When: just now',
      when: 'When: {ago} ago',
      pureAlcohol: 'Pure alcohol',
      savePreset: 'Save as preset for quick adding',
      add: 'Add'
    },

    edit: {
      title: 'Edit drink',
      save: 'Save changes',
      delete: 'Delete'
    },

    time: {
      title: 'When was it?',
      addToJournal: 'Add to journal',
      now: 'Now',
      m30: '30 min ago',
      h2: '2 hours ago',
      yesterday20: 'Yesterday 8 pm',
      weekAgo: 'Week ago',
      relJustNow: 'just now',
      relMinAgo: '{n} min ago',
      relHourAgo: '{n} h ago · {time}',
      relYesterday: 'yesterday · {time}',
      relDaysAgo: '{n} days ago · {time}',
      relInFuture: 'in the future · {time}'
    },

    consent: {
      title: 'Before you start',
      subtitle: 'Please read carefully',
      adultOnly: '<strong>For adults only (18+).</strong> This app is not intended for minors.',
      estimateOnly: "<strong>This is an estimate, not a measurement.</strong> Calculations use the Widmark formula based on your data and drink log. Actual blood alcohol depends on many individual factors and may differ significantly.",
      notForDriving: '<strong>Not for driving decisions.</strong> No software calculator can replace a certified breathalyzer or a blood test. Never drive based solely on this estimate.',
      acceptHint: 'By tapping "I understand and agree", you confirm that you are at least 18 years old and that you understand the limits of this app\'s accuracy.',
      accept: 'I understand and agree'
    },

    footer1: 'Calculations use the Widmark formula — this is an approximate estimate. Individual factors (food, medications, health, drinking pace) can significantly change the actual level.',
    footer2: 'This app cannot replace a real breathalyzer or blood test.',
    footer3: 'Never rely on a calculator alone to decide whether to drive.',

    presets: {
      beerLight: 'Light beer',
      beerStrong: 'Strong beer',
      wine: 'Wine',
      champagne: 'Champagne',
      vodka: 'Vodka',
      whiskey: 'Whiskey',
      cocktail: 'Cocktail'
    },

    confirm: {
      removePreset: 'Remove "{name}" from presets?'
    }
  }
};

// Resolve a dotted key path against a dict tree, falling back to UA, then to the key string.
function resolve(tree, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), tree);
}

function interpolate(str, params) {
  if (typeof str !== 'string' || !params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

// Pluralization for Slavic-style 1 / 2-4 / 5+
// English fallback: 1 = one, anything else = many
export function plural(locale, n, forms) {
  if (locale === 'uk') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms.one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few;
    return forms.many;
  }
  return n === 1 ? forms.one : forms.many;
}

// React context — single source of truth for current locale
const I18nContext = createContext({ locale: DEFAULT_LOCALE, t: (k) => k, plural });

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const t = (key, params) => {
    let val = resolve(dict[locale], key);
    if (val === undefined) val = resolve(dict[DEFAULT_LOCALE], key);
    if (val === undefined) return key;
    return interpolate(val, params);
  };

  const setLocaleManual = (l) => {
    if (SUPPORTED.includes(l)) {
      setItem(LOCALE_KEY, l);
      setLocale(l);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, t, plural, setLocale: setLocaleManual }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
