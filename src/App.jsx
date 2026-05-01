import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceDot,
  ResponsiveContainer, Tooltip, CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import {
  Trash2, Plus, Settings, Check, Clock, X,
  BarChart3, User, ShieldAlert, ChevronLeft, Star, CalendarClock
} from 'lucide-react';
import { getItem, setItem } from './storage';
import { useT, plural } from './i18n.jsx';

// ====== CONSTANTS ======
const ETHANOL_DENSITY = 0.789;
const ELIMINATION_RATE = 0.15;
const R_MALE = 0.68;
const R_FEMALE = 0.55;
const STORAGE_KEY = 'data';
const CONSENT_KEY = 'consent';

// UK CMO low-risk drinking guideline: 14 units = 112 g pure ethanol per week.
const UK_WEEKLY_GRAMS = 112;
const UK_BINGE_GRAMS_MALE = 64;     // 8 units
const UK_BINGE_GRAMS_FEMALE = 48;   // 6 units
const UK_INCREASING_RISK_GRAMS = 280; // 35 units

// ====== COLOR TOKENS ======
const C = {
  bg:        '#fbf7f0',
  card:      '#fffcf6',
  border:    '#ece2cf',
  borderHv:  '#ddc99e',
  ink:       '#3d2c12',
  inkSoft:   '#6b5536',
  inkMute:   '#a89876',
  amber:     '#b8731a',
  amberDeep: '#7a4a0e',
  amberSoft: '#fde9c4',
  ok:        '#0f7c52',
  okSoft:    '#d4f0e0',
  warn:      '#a36500',
  warnSoft:  '#fbe4b8',
  bad:       '#b91c1c',
  badSoft:   '#fbd8d8',
  grid:      '#f0e7d3',
};

const DEFAULT_PROFILE = { gender: 'male', weight: 75, legalLimit: 0.5 };

// Built-in presets reference i18n keys for names
const BUILTIN_PRESETS = [
  { id: 'beer-light',  nameKey: 'presets.beerLight',  volumeMl: 500, alcoholPct: 5,  icon: '🍺', builtin: true },
  { id: 'beer-strong', nameKey: 'presets.beerStrong', volumeMl: 500, alcoholPct: 7,  icon: '🍻', builtin: true },
  { id: 'wine',        nameKey: 'presets.wine',       volumeMl: 150, alcoholPct: 12, icon: '🍷', builtin: true },
  { id: 'champagne',   nameKey: 'presets.champagne',  volumeMl: 150, alcoholPct: 11, icon: '🥂', builtin: true },
  { id: 'vodka',       nameKey: 'presets.vodka',      volumeMl: 50,  alcoholPct: 40, icon: '🥃', builtin: true },
  { id: 'whiskey',     nameKey: 'presets.whiskey',    volumeMl: 50,  alcoholPct: 40, icon: '🥃', builtin: true },
  { id: 'cocktail',    nameKey: 'presets.cocktail',   volumeMl: 200, alcoholPct: 15, icon: '🍹', builtin: true }
];

const DRINK_ICONS = ['🍺', '🍻', '🍷', '🥂', '🥃', '🍹', '🍶', '🍾', '🧃'];

// ====== INLINE DROP LOGO ======
// Same droplet as launcher icon (resources/icon.png), rendered as SVG.
function DropLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="logoBg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#1a0f08" />
          <stop offset="100%" stopColor="#050302" />
        </radialGradient>
        <linearGradient id="logoDroplet" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#f4c896" />
          <stop offset="100%" stopColor="#8b5e34" />
        </linearGradient>
        <linearGradient id="logoHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#logoBg)" />
      <path d="M256 110 C 256 110, 380 245, 380 340 C 380 410, 324 462, 256 462 C 188 462, 132 410, 132 340 C 132 245, 256 110, 256 110 Z" fill="url(#logoDroplet)" />
      <ellipse cx="210" cy="280" rx="38" ry="55" fill="url(#logoHighlight)" transform="rotate(-25 210 280)" />
    </svg>
  );
}

// ====== BAC MATH (Widmark, per-drink elimination) ======
const alcoholGrams = (mlVolume, pct) => mlVolume * (pct / 100) * ETHANOL_DENSITY;

function calculateBAC(drinks, profile, atMs) {
  if (!drinks?.length) return 0;
  const r = profile.gender === 'male' ? R_MALE : R_FEMALE;
  let total = 0;
  for (const d of drinks) {
    if (d.timestamp > atMs) continue;
    const peak = alcoholGrams(d.volumeMl, d.alcoholPct) / (profile.weight * r);
    const hoursSince = (atMs - d.timestamp) / 3600000;
    const remaining = peak - ELIMINATION_RATE * hoursSince;
    if (remaining > 0) total += remaining;
  }
  return total;
}

function projectSeries(drinks, profile, fromMs, toMs, stepMs = 10 * 60 * 1000) {
  const out = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    out.push({ time: t, bac: +calculateBAC(drinks, profile, t).toFixed(3) });
  }
  return out;
}

const timeUntilSafe = (currentBAC, limit) =>
  currentBAC <= limit ? 0 : ((currentBAC - limit) / ELIMINATION_RATE) * 3600000;

// ====== FORMATTERS (i18n-aware where it matters) ======
function useDur() {
  // Localized "X хв" / "X год Y хв" — uses the time.relMinAgo/Hour as building blocks would be wrong;
  // duration is its own thing, so we keep simple inline labels.
  const { locale } = useT();
  return (ms) => {
    if (ms <= 0) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (locale === 'en') return h === 0 ? `${m} min` : `${h} h ${m} min`;
    return h === 0 ? `${m} хв` : `${h} год ${m} хв`;
  };
}

function useFmt() {
  const { locale } = useT();
  const lc = locale === 'en' ? 'en-GB' : 'uk-UA';
  return {
    time: (ms) => new Date(ms).toLocaleTimeString(lc, { hour: '2-digit', minute: '2-digit' }),
    dayShort: (ms) => new Date(ms).toLocaleDateString(lc, { day: '2-digit', month: 'short' }),
    dayLong: (ms) => new Date(ms).toLocaleDateString(lc, { day: 'numeric', month: 'long', weekday: 'long' }),
  };
}

const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toLocalInput = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (str) => new Date(str).getTime();

function useFmtRelative() {
  const { t } = useT();
  const fmt = useFmt();
  return (ms) => {
    const diff = Date.now() - ms;
    if (diff < 0) return t('time.relInFuture', { time: fmt.time(ms) });
    if (diff < 60000) return t('time.relJustNow');
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('time.relMinAgo', { n: mins });
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return t('time.relHourAgo', { n: hours, time: fmt.time(ms) });
    const days = Math.floor(diff / 86400000);
    if (days === 1) return t('time.relYesterday', { time: fmt.time(ms) });
    if (days < 7) return t('time.relDaysAgo', { n: days, time: fmt.time(ms) });
    return `${fmt.dayShort(ms)} · ${fmt.time(ms)}`;
  };
}

// Resolve drink display name: prefer explicit `name`, else translate `nameKey`.
function drinkName(drink, t) {
  if (drink.name) return drink.name;
  if (drink.nameKey) return t(drink.nameKey);
  return '—';
}

// Weekly stats over rolling 7 days
function computeWeeklyStats(drinks, profile, nowMs) {
  const weekAgo = nowMs - 7 * 86400000;
  const inWindow = drinks.filter(d => d.timestamp >= weekAgo && d.timestamp <= nowMs);
  const byDay = {};
  for (const d of inWindow) {
    const k = dayKey(d.timestamp);
    byDay[k] = (byDay[k] || 0) + alcoholGrams(d.volumeMl, d.alcoholPct);
  }
  const totalGrams   = Object.values(byDay).reduce((s, v) => s + v, 0);
  const drinkingDays = Object.keys(byDay).length;
  const dryDays      = 7 - drinkingDays;
  const biggestDay   = Math.max(0, ...Object.values(byDay));
  const bingeThreshold = profile?.gender === 'female' ? UK_BINGE_GRAMS_FEMALE : UK_BINGE_GRAMS_MALE;
  const bingeDays = Object.values(byDay).filter(g => g >= bingeThreshold).length;
  return { totalGrams, drinkingDays, dryDays, biggestDay, bingeDays, bingeThreshold };
}

// ====== APP ======
export default function App() {
  const { t } = useT();

  const [profile, setProfile] = useState(null);
  const [drinks, setDrinks] = useState([]);
  const [customPresets, setCustomPresets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [consented, setConsented] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [timePickerFor, setTimePickerFor] = useState(null);
  const [editingDrink, setEditingDrink] = useState(null);  // <- new: edit modal state
  const [statsRange, setStatsRange] = useState('day');
  const [selectedDay, setSelectedDay] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    const data = getItem(STORAGE_KEY);
    if (data) {
      setProfile(data.profile || null);
      setDrinks(data.drinks || []);
      setCustomPresets(data.customPresets || []);
    }
    setConsented(getItem(CONSENT_KEY) === true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && profile) setItem(STORAGE_KEY, { profile, drinks, customPresets });
  }, [profile, drinks, customPresets, loaded]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loaded && consented && !profile) setShowProfile(true);
  }, [loaded, consented, profile]);

  const currentBAC = useMemo(
    () => (profile ? calculateBAC(drinks, profile, now) : 0),
    [drinks, profile, now]
  );

  const limit = profile?.legalLimit ?? 0.5;
  const safeAt = useMemo(() => {
    if (!profile || currentBAC <= limit) return null;
    return now + timeUntilSafe(currentBAC, limit);
  }, [currentBAC, limit, now, profile]);

  const status = useMemo(() => {
    if (currentBAC === 0)    return { labelKey: 'status.sober',    fg: C.ok,   bg: C.okSoft,   ring: '#bce5cf' };
    if (currentBAC <= limit) return { labelKey: 'status.ok',       fg: C.ok,   bg: C.okSoft,   ring: '#bce5cf' };
    if (currentBAC <= 1.5)   return { labelKey: 'status.noDrive',  fg: C.warn, bg: C.warnSoft, ring: '#f0d49a' };
    return                          { labelKey: 'status.danger',   fg: C.bad,  bg: C.badSoft,  ring: '#f3b3b3' };
  }, [currentBAC, limit]);

  const chartData = useMemo(() => {
    if (!profile || !drinks.length) return [];
    const sorted = [...drinks].sort((a, b) => a.timestamp - b.timestamp);
    const start = sorted[0].timestamp;
    let end = now + 60 * 60 * 1000;
    if (currentBAC > 0) {
      end = Math.max(end, now + (currentBAC / ELIMINATION_RATE) * 3600000 + 30 * 60 * 1000);
    }
    return projectSeries(drinks, profile, start, end);
  }, [drinks, profile, now, currentBAC]);

  // Translate built-in preset names; custom presets keep their literal name.
  const allPresets = useMemo(() => {
    const builtins = BUILTIN_PRESETS.map(p => ({ ...p, name: t(p.nameKey) }));
    return [...builtins, ...customPresets];
  }, [customPresets, t]);

  const addDrink = (preset, customTime = null) => {
    setDrinks(prev => [...prev, {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      name: preset.name,
      volumeMl: preset.volumeMl,
      alcoholPct: preset.alcoholPct,
      icon: preset.icon,
      timestamp: customTime ?? Date.now()
    }]);
    setNow(Date.now());
  };
  const removeDrink = (id) => setDrinks(prev => prev.filter(d => d.id !== id));

  // Update existing drink — handles both id-based merge and full replace.
  const updateDrink = (id, patch) => {
    setDrinks(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    setNow(Date.now());
  };

  const saveCustomPreset = (preset) => {
    setCustomPresets(prev => [...prev, {
      ...preset,
      id: 'custom-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()),
      builtin: false
    }]);
  };
  const removeCustomPreset = (id) =>
    setCustomPresets(prev => prev.filter(p => p.id !== id));

  const acceptConsent = () => {
    setItem(CONSENT_KEY, true);
    setConsented(true);
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: C.bg, color: C.inkSoft, fontFamily: "'DM Sans', sans-serif" }}>
        {t('loading')}
      </div>
    );
  }

  if (!consented) return <ConsentScreen onAccept={acceptConsent} />;

  if (selectedDay) {
    return (
      <DayDetailScreen
        dayMs={selectedDay}
        drinks={drinks.filter(d => dayKey(d.timestamp) === dayKey(selectedDay))}
        onBack={() => setSelectedDay(null)}
        onRemove={removeDrink}
        onEdit={setEditingDrink}
        editingDrink={editingDrink}
        onCloseEdit={() => setEditingDrink(null)}
        onSaveEdit={(patch) => { updateDrink(editingDrink.id, patch); setEditingDrink(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen"
         style={{ background: C.bg, color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        .num-tabular { font-variant-numeric: tabular-nums; }
        .card {
          background: ${C.card};
          border: 1px solid ${C.border};
          box-shadow: 0 1px 2px rgba(120, 80, 30, 0.04);
        }
        .card-hover:hover { background: #fff8eb; border-color: ${C.borderHv}; }
        .pill-btn:hover { background: #f3e6cd; }
        body { background: ${C.bg}; }
        ::selection { background: ${C.amberSoft}; color: ${C.ink}; }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DropLogo size={36} />
            <div>
              <div className="text-lg font-bold tracking-tight leading-none" style={{ color: C.ink }}>
                {t('appName')}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] mt-1 font-medium" style={{ color: C.inkMute }}>
                {t('appTagline')}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="card pill-btn rounded-full px-3 py-2 text-xs flex items-center gap-2 transition active:scale-95 font-medium"
            style={{ color: C.inkSoft }}
          >
            <User className="w-3.5 h-3.5" style={{ color: C.amber }} />
            <span className="hidden sm:inline">
              {profile ? `${profile.gender === 'male' ? (t('profile.male')[0]) : (t('profile.female')[0])} · ${profile.weight} ${t('profile.weight').includes('kg') ? 'kg' : 'кг'}` : t('profile.title')}
            </span>
            <Settings className="w-3.5 h-3.5" style={{ color: C.inkMute }} />
          </button>
        </header>

        {/* Hero BAC */}
        <HeroBAC
          currentBAC={currentBAC}
          limit={limit}
          safeAt={safeAt}
          now={now}
          status={status}
        />

        {/* Weekly UK CMO tracker */}
        <WeeklyTracker drinks={drinks} profile={profile} now={now} />

        {/* Chart */}
        {drinks.length > 0 && (
          <section className="card rounded-3xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold" style={{ color: C.ink }}>{t('chart.title')}</h2>
              <div className="text-[10px] uppercase tracking-wider flex items-center gap-1.5 font-semibold"
                   style={{ color: C.inkMute }}>
                <Clock className="w-3 h-3" /> {t('chart.realtime')}
              </div>
            </div>
            <BACChart data={chartData} now={now} limit={limit} safeAt={safeAt} />
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[11px] font-medium" style={{ color: C.inkSoft }}>
              <Legend color={C.amber} label={t('chart.bacLevel')} />
              <Legend color={C.bad} label={t('chart.legalLimit')} dashed />
              <Legend color={C.ok} label={t('chart.canDrive')} dot />
            </div>
          </section>
        )}

        {/* Add drink */}
        <section className="mb-4">
          <h2 className="text-base font-bold mb-3 px-1" style={{ color: C.ink }}>{t('add.title')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {allPresets.map(p => (
              <DrinkButton
                key={p.id}
                preset={p}
                onTap={() => addDrink(p)}
                onPickTime={() => setTimePickerFor(p)}
                onLongPress={p.builtin ? null : () => removeCustomPreset(p.id)}
              />
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className="card card-hover rounded-2xl p-3 text-left transition active:scale-95 flex flex-col items-start justify-center"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center mb-1.5"
                   style={{ background: C.amberSoft }}>
                <Plus className="w-4 h-4" strokeWidth={2.5} style={{ color: C.amberDeep }} />
              </div>
              <div className="text-sm font-semibold" style={{ color: C.ink }}>{t('add.other')}</div>
              <div className="text-[11px] mt-0.5" style={{ color: C.inkMute }}>{t('add.ownDrink')}</div>
            </button>
          </div>
          {customPresets.length > 0 && (
            <p className="text-[11px] mt-2 px-1" style={{ color: C.inkMute }}>{t('add.hintRemovePreset')}</p>
          )}
          <p className="text-[11px] mt-1 px-1" style={{ color: C.inkMute }}>{t('add.hintClock')}</p>
        </section>

        {/* Stats */}
        <StatsPanel
          drinks={drinks}
          range={statsRange}
          setRange={setStatsRange}
          now={now}
          onRemove={removeDrink}
          onEdit={setEditingDrink}
          onSelectDay={setSelectedDay}
        />

        <footer className="mt-8 text-center text-[10px] tracking-wide leading-relaxed px-2"
                style={{ color: C.inkMute }}>
          {t('footer1')}
          <br />
          <strong style={{ color: C.inkSoft }}>{t('footer2')}</strong>
          <br />
          {t('footer3')}
        </footer>
      </div>

      {showProfile && (
        <ProfileModal
          profile={profile || DEFAULT_PROFILE}
          onClose={() => profile && setShowProfile(false)}
          onSave={(p) => { setProfile(p); setShowProfile(false); }}
          firstRun={!profile}
        />
      )}

      {showCustom && (
        <CustomDrinkModal
          onClose={() => setShowCustom(false)}
          onAdd={(d, ts, save) => {
            addDrink(d, ts);
            if (save) saveCustomPreset(d);
            setShowCustom(false);
          }}
        />
      )}

      {timePickerFor && (
        <TimePickerModal
          preset={timePickerFor}
          onClose={() => setTimePickerFor(null)}
          onAdd={(ts) => {
            addDrink(timePickerFor, ts);
            setTimePickerFor(null);
          }}
        />
      )}

      {editingDrink && (
        <EditDrinkModal
          drink={editingDrink}
          onClose={() => setEditingDrink(null)}
          onSave={(patch) => { updateDrink(editingDrink.id, patch); setEditingDrink(null); }}
          onDelete={() => { removeDrink(editingDrink.id); setEditingDrink(null); }}
        />
      )}
    </div>
  );
}

// ====== HERO BAC (separate so we can call useT cleanly inside) ======
function HeroBAC({ currentBAC, limit, safeAt, now, status }) {
  const { t } = useT();
  const fmt = useFmt();
  const dur = useDur();

  return (
    <section className="card rounded-3xl p-6 sm:p-7 mb-4"
             style={{ boxShadow: `0 0 0 2px ${status.ring}, 0 1px 2px rgba(120,80,30,0.04)` }}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: C.inkMute }}>
          {t('hero.currentLevel')}
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-full"
             style={{ background: status.bg, color: status.fg }}>
          {t(status.labelKey)}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="num-tabular text-7xl sm:text-8xl leading-none font-bold tracking-tight"
             style={{ color: status.fg }}>
          {currentBAC.toFixed(2)}
        </div>
        <div className="text-lg pb-3 font-medium" style={{ color: C.inkMute }}>‰</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5 pt-5" style={{ borderTop: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: C.inkMute }}>
            {t('hero.legalLimit')}
          </div>
          <div className="num-tabular font-medium" style={{ color: C.ink }}>{limit.toFixed(2)} ‰</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: C.inkMute }}>
            {t('hero.canDrive')}
          </div>
          <div className="num-tabular font-medium text-sm" style={{ color: C.ink }}>
            {safeAt
              ? <span dangerouslySetInnerHTML={{
                  __html: t('hero.canDriveIn', {
                    dur: `<span style="color:${C.amberDeep};font-weight:600">${dur(safeAt - now)}</span>`,
                    time: fmt.time(safeAt)
                  })
                }} />
              : <span className="font-semibold" style={{ color: C.ok }}>{t('hero.canDriveNow')}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ====== DRINK BUTTON ======
function DrinkButton({ preset, onTap, onPickTime, onLongPress }) {
  const { t } = useT();
  const [pressing, setPressing] = useState(false);
  const timer = React.useRef(null);

  const start = () => {
    if (!onLongPress) return;
    setPressing(true);
    timer.current = setTimeout(() => {
      if (confirm(t('confirm.removePreset', { name: preset.name }))) onLongPress();
      setPressing(false);
    }, 600);
  };
  const cancel = () => {
    setPressing(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div
      className="card card-hover rounded-2xl p-3 transition relative"
      style={pressing ? { boxShadow: `0 0 0 2px ${C.amber}` } : {}}
    >
      <button
        onClick={onTap}
        onTouchStart={start}
        onTouchEnd={cancel}
        onTouchCancel={cancel}
        onMouseDown={start}
        onMouseUp={cancel}
        onMouseLeave={cancel}
        className="block text-left w-full active:scale-95 transition"
      >
        <div className="text-2xl mb-1.5">{preset.icon || '🥃'}</div>
        <div className="text-sm font-semibold leading-tight truncate pr-5" style={{ color: C.ink }}>
          {preset.name}
        </div>
        <div className="text-[11px] mt-0.5 num-tabular font-medium" style={{ color: C.inkMute }}>
          {preset.volumeMl} {t('stats.volumeMl').includes('ml') ? 'ml' : 'мл'} · {preset.alcoholPct}%
        </div>
      </button>

      {!preset.builtin && (
        <Star className="absolute top-2 left-2 w-3 h-3" style={{ color: C.amber, fill: C.amber }} />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onPickTime(); }}
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90"
        style={{ background: '#f5ead0', color: C.amberDeep }}
        onMouseEnter={(e) => e.currentTarget.style.background = C.amberSoft}
        onMouseLeave={(e) => e.currentTarget.style.background = '#f5ead0'}
        aria-label="time"
      >
        <CalendarClock className="w-3.5 h-3.5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ====== WEEKLY TRACKER (UK CMO) ======
function WeeklyTracker({ drinks, profile, now }) {
  const { t } = useT();
  const stats = useMemo(() => computeWeeklyStats(drinks, profile, now), [drinks, profile, now]);
  const { totalGrams, drinkingDays, dryDays, biggestDay, bingeDays, bingeThreshold } = stats;
  const percent = (totalGrams / UK_WEEKLY_GRAMS) * 100;

  let bandColor, bandSoft, bandLabel, bandIcon;
  if (totalGrams === 0) {
    bandColor = C.ok;   bandSoft = C.okSoft;   bandLabel = t('weekly.bandSober');      bandIcon = '🌿';
  } else if (totalGrams <= UK_WEEKLY_GRAMS) {
    bandColor = C.ok;   bandSoft = C.okSoft;   bandLabel = t('weekly.bandLow');        bandIcon = '✓';
  } else if (totalGrams <= UK_INCREASING_RISK_GRAMS) {
    bandColor = C.warn; bandSoft = C.warnSoft; bandLabel = t('weekly.bandIncreasing'); bandIcon = '⚠';
  } else {
    bandColor = C.bad;  bandSoft = C.badSoft;  bandLabel = t('weekly.bandHigh');       bandIcon = '⚠';
  }

  let spreadHint = null;
  if (totalGrams > 0) {
    if (drinkingDays === 1 && totalGrams >= UK_WEEKLY_GRAMS / 2) {
      spreadHint = { text: t('weekly.hintAllOneDay'), color: C.warn };
    } else if (drinkingDays >= 3 && totalGrams <= UK_WEEKLY_GRAMS) {
      spreadHint = { text: t('weekly.hintGoodSpread', { n: drinkingDays }), color: C.ok };
    } else if (drinkingDays === 7) {
      spreadHint = { text: t('weekly.hintNoDryDays'), color: C.warn };
    }
  }

  const [expanded, setExpanded] = useState(false);
  const visualPct = Math.min(200, percent);
  const lowRiskMarkPct = 50;

  return (
    <section className="card rounded-3xl p-5 sm:p-6 mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold" style={{ color: C.ink }}>{t('weekly.title')}</h2>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 transition"
            style={{ background: '#f5ead0', color: C.inkSoft }}
          >
            UK CMO ⓘ
          </button>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-full"
             style={{ background: bandSoft, color: bandColor }}>
          {bandIcon} {bandLabel}
        </div>
      </div>

      <div className="flex items-end justify-between mt-3 mb-2">
        <div>
          <div className="num-tabular text-4xl sm:text-5xl leading-none font-bold tracking-tight"
               style={{ color: bandColor }}>
            {totalGrams.toFixed(0)}
            <span className="text-xl font-medium" style={{ color: C.inkMute }}> / {UK_WEEKLY_GRAMS} {t('stats.alcoholG').includes('Alc') ? 'g' : 'г'}</span>
          </div>
          <div className="text-[11px] mt-1.5 font-medium" style={{ color: C.inkSoft }}>
            {t('weekly.lastSevenDays', { units: (totalGrams / 8).toFixed(1) })}
          </div>
        </div>
        <div className="text-right">
          <div className="num-tabular text-2xl font-bold" style={{ color: bandColor }}>
            {percent.toFixed(0)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.inkMute }}>
            {t('weekly.ofLimit')}
          </div>
        </div>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden mb-1" style={{ background: '#f0e3c8' }}>
        <div className="h-full rounded-full transition-all"
             style={{ width: `${(visualPct / 200) * 100}%`, background: bandColor }} />
        <div className="absolute top-0 bottom-0 w-px"
             style={{ left: `${lowRiskMarkPct}%`, background: 'rgba(60,40,15,0.3)' }} />
      </div>
      <div className="flex justify-between text-[9px] num-tabular font-semibold mb-3" style={{ color: C.inkMute }}>
        <span>0</span>
        <span style={{ marginLeft: '-12px' }}>{t('weekly.norm', { g: 112 })}</span>
        <span>224+</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SubMetric
          label={t('weekly.dryDays')}
          value={dryDays}
          good={dryDays >= 2}
          warn={dryDays === 0 && totalGrams > 0}
          subtitle={t('weekly.ofSeven')}
        />
        <SubMetric
          label={t('weekly.biggestDay')}
          value={`${biggestDay.toFixed(0)} ${t('stats.alcoholG').includes('Alc') ? 'g' : 'г'}`}
          good={biggestDay > 0 && biggestDay < bingeThreshold}
          warn={biggestDay >= bingeThreshold}
          subtitle={biggestDay >= bingeThreshold ? t('weekly.tooMuch') : t('weekly.withinSafe', { g: bingeThreshold })}
        />
        <SubMetric
          label={t('weekly.riskDays')}
          value={bingeDays}
          good={bingeDays === 0 && totalGrams > 0}
          warn={bingeDays > 0}
          subtitle={bingeDays > 0 ? t('weekly.bingeShort') : t('weekly.noBinge')}
        />
      </div>

      {spreadHint && (
        <div className="mt-3 text-[11px] font-medium px-3 py-2 rounded-lg"
             style={{ background: '#faf3e0', color: spreadHint.color }}>
          {spreadHint.text}
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-4 text-[11px] leading-relaxed space-y-2"
             style={{ color: C.inkSoft, borderTop: `1px solid ${C.border}` }}>
          <p dangerouslySetInnerHTML={{ __html: t('weekly.explainP1') }} />
          <p dangerouslySetInnerHTML={{
            __html: t('weekly.explainP2', {
              threshold: bingeThreshold,
              gender: profile?.gender === 'female' ? t('weekly.genderWomen') : t('weekly.genderMen')
            })
          }} />
          <p style={{ color: C.inkMute }}>{t('weekly.explainP3')}</p>
        </div>
      )}
    </section>
  );
}

const SubMetric = ({ label, value, subtitle, good, warn }) => {
  let color = C.inkSoft;
  if (good) color = C.ok;
  if (warn) color = C.bad;
  return (
    <div className="rounded-lg px-2.5 py-2.5"
         style={{ background: '#faf3e0', border: `1px solid ${C.border}` }}>
      <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: C.inkMute }}>
        {label}
      </div>
      <div className="num-tabular text-lg leading-none font-bold mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] font-medium" style={{ color: C.inkMute }}>{subtitle}</div>
    </div>
  );
};

// ====== CHART ======
function BACChart({ data, now, limit, safeAt }) {
  const fmt = useFmt();
  if (!data.length) return null;
  const maxBac = Math.max(limit * 1.4, ...data.map(d => d.bac)) * 1.1;

  return (
    <div className="h-52 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="bacFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.amber} />
              <stop offset="100%" stopColor={C.amberDeep} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="time" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={fmt.time}
            stroke={C.inkMute} tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: C.inkMute }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, maxBac]}
            stroke={C.inkMute} tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: C.inkMute }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => v.toFixed(1)} width={32}
          />
          <Tooltip
            contentStyle={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, fontFamily: 'DM Sans', fontSize: 12,
              color: C.ink, boxShadow: '0 4px 12px rgba(120,80,30,0.08)'
            }}
            labelFormatter={(v) => fmt.time(v)} formatter={(v) => [`${v} ‰`, 'BAC']}
          />
          <ReferenceLine y={limit} stroke={C.bad} strokeDasharray="4 4" strokeOpacity={0.7} />
          <ReferenceLine x={now} stroke={C.inkMute} strokeDasharray="2 4" />
          <Line type="monotone" dataKey="bac" stroke="url(#bacFill)" strokeWidth={2.5}
                dot={false} isAnimationActive={false} />
          {safeAt && safeAt <= data[data.length - 1].time && (
            <ReferenceDot x={safeAt} y={limit} r={5} fill={C.ok} stroke={C.card} strokeWidth={2} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const Legend = ({ color, label, dashed, dot }) => (
  <div className="flex items-center gap-1.5">
    {dot ? (
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
    ) : (
      <span className="inline-block w-4 h-[2px]"
            style={{
              background: dashed
                ? `repeating-linear-gradient(to right, ${color} 0 3px, transparent 3px 6px)`
                : color
            }} />
    )}
    <span>{label}</span>
  </div>
);

// ====== STATS PANEL ======
function StatsPanel({ drinks, range, setRange, now, onRemove, onEdit, onSelectDay }) {
  const { t, locale } = useT();

  const stats = useMemo(() => {
    const d = new Date(now);
    let from, daysInRange;
    if (range === 'day') {
      from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      daysInRange = 1;
    } else if (range === 'month') {
      from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      daysInRange = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    } else {
      from = new Date(d.getFullYear(), 0, 1).getTime();
      daysInRange = Math.ceil((now - from) / 86400000);
    }
    const f = drinks.filter(x => x.timestamp >= from && x.timestamp <= now);
    const totalAlc = f.reduce((s, x) => s + alcoholGrams(x.volumeMl, x.alcoholPct), 0);
    const totalVol = f.reduce((s, x) => s + x.volumeMl, 0);
    const grouped = {};
    for (const x of f) {
      const k = dayKey(x.timestamp);
      if (!grouped[k]) grouped[k] = { grams: 0, drinks: 0, ms: x.timestamp };
      grouped[k].grams += alcoholGrams(x.volumeMl, x.alcoholPct);
      grouped[k].drinks += 1;
    }
    const drinkingDays = Object.keys(grouped).length;
    const dryDays = Math.max(0, daysInRange - drinkingDays);
    const avgPerDay = totalAlc / Math.max(1, daysInRange);

    const seriesDays = [];
    if (range !== 'day') {
      for (let i = 0; i < daysInRange; i++) {
        const date = new Date(from + i * 86400000);
        if (date > d) break;
        const k = dayKey(date.getTime());
        seriesDays.push({
          ms: date.getTime(),
          dayLabel: date.getDate(),
          grams: grouped[k]?.grams || 0,
          drinks: grouped[k]?.drinks || 0
        });
      }
    }

    return { filtered: f, totalAlc, totalDrinks: f.length, totalVol, dryDays, drinkingDays, avgPerDay, seriesDays };
  }, [drinks, range, now]);

  const ukLimit = range === 'month' ? UK_WEEKLY_GRAMS * 4
                : range === 'year'  ? UK_WEEKLY_GRAMS * 52 : null;
  const ukPercent = ukLimit ? (stats.totalAlc / ukLimit) * 100 : 0;
  const ukColor = ukPercent > 100 ? C.bad : ukPercent > 70 ? C.warn : C.ok;

  return (
    <section className="card rounded-3xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold" style={{ color: C.ink }}>{t('stats.title')}</h2>
        <div className="flex rounded-full p-1 text-xs" style={{ background: '#f0e3c8' }}>
          {[
            { id: 'day',   label: t('stats.day') },
            { id: 'month', label: t('stats.month') },
            { id: 'year',  label: t('stats.year') }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className="px-3 py-1.5 rounded-full transition font-semibold"
              style={
                range === opt.id
                  ? { background: C.ink, color: C.bg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: C.inkSoft, background: 'transparent' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label={t('stats.drinks')} value={stats.totalDrinks} />
        <Stat label={t('stats.volumeMl')} value={stats.totalVol.toFixed(0)} />
        <Stat label={t('stats.alcoholG')} value={stats.totalAlc.toFixed(0)} highlight />
      </div>

      {range !== 'day' && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <SmallStat label={t('stats.dryDays')}    value={stats.dryDays} />
            <SmallStat label={t('stats.withDrinks')} value={stats.drinkingDays} />
            <SmallStat label={t('stats.avgPerDay')}  value={`${stats.avgPerDay.toFixed(1)} ${t('stats.alcoholG').includes('Alc') ? 'g' : 'г'}`} />
          </div>

          {ukLimit && stats.totalAlc > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                <span style={{ color: C.inkSoft }}>
                  {t('stats.ukNorm', { limit: ukLimit, period: t(range === 'month' ? 'stats.periodMonth' : 'stats.periodYear') })}
                </span>
                <span className="num-tabular font-semibold" style={{ color: ukColor }}>
                  {ukPercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0e3c8' }}>
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${Math.min(100, ukPercent)}%`, background: ukColor }} />
              </div>
            </div>
          )}

          {stats.seriesDays.length > 0 && (
            <DayBars days={stats.seriesDays} onTap={(ms) => onSelectDay(ms)} />
          )}
        </>
      )}

      {stats.filtered.length === 0 ? (
        <div className="text-center py-6 text-sm" style={{ color: C.inkMute }}>
          {range === 'day' ? t('stats.emptyDay') :
           range === 'month' ? t('stats.emptyMonth') :
                               t('stats.emptyYear')}
        </div>
      ) : range === 'day' && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider mb-2 px-1 font-semibold" style={{ color: C.inkMute }}>
            {t('stats.drinkList')}
          </div>
          {[...stats.filtered].sort((a, b) => b.timestamp - a.timestamp).map(d => (
            <DrinkRow key={d.id} drink={d} onRemove={() => onRemove(d.id)} onEdit={() => onEdit(d)} />
          ))}
          <p className="text-[10px] mt-2 px-1" style={{ color: C.inkMute }}>{t('stats.tapToEdit')}</p>
        </div>
      )}
    </section>
  );
}

const Stat = ({ label, value, highlight }) => (
  <div className="rounded-xl px-3 py-3"
       style={highlight
         ? { background: C.ink, color: C.bg }
         : { background: '#f5ead0', color: C.ink, border: `1px solid ${C.border}` }}>
    <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
         style={{ color: highlight ? C.amberSoft : C.inkSoft, opacity: 0.8 }}>
      {label}
    </div>
    <div className="num-tabular text-2xl sm:text-3xl leading-none font-bold"
         style={{ color: highlight ? C.bg : C.ink }}>
      {value}
    </div>
  </div>
);

const SmallStat = ({ label, value }) => (
  <div className="rounded-lg px-2.5 py-2"
       style={{ background: '#faf3e0', border: `1px solid ${C.border}` }}>
    <div className="text-[9px] uppercase tracking-wider mb-0.5 font-semibold" style={{ color: C.inkMute }}>{label}</div>
    <div className="num-tabular text-base leading-none font-semibold" style={{ color: C.ink }}>{value}</div>
  </div>
);

// Drink row — now tap = edit, trash icon = quick delete
function DrinkRow({ drink, onRemove, onEdit }) {
  const { t } = useT();
  const fmt = useFmt();
  const isMl = !t('stats.volumeMl').includes('ml');
  const mlLabel = isMl ? 'мл' : 'ml';
  const gLabel = t('stats.alcoholG').includes('Alc') ? 'g' : 'г';

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl group transition cursor-pointer"
         onClick={onEdit}
         onMouseEnter={(e) => e.currentTarget.style.background = '#faf3e0'}
         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div className="num-tabular text-xs w-12 font-medium" style={{ color: C.inkMute }}>{fmt.time(drink.timestamp)}</div>
      <div className="text-lg w-6">{drink.icon || '🥃'}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{drinkName(drink, t)}</div>
        <div className="text-[11px] num-tabular font-medium" style={{ color: C.inkMute }}>
          {drink.volumeMl} {mlLabel} · {drink.alcoholPct}% · {alcoholGrams(drink.volumeMl, drink.alcoholPct).toFixed(1)} {gLabel} {t('stats.gOfAlc').includes('alc') ? 'of alc' : 'спирту'}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg transition"
        style={{ color: C.bad }}
        onMouseEnter={(e) => e.currentTarget.style.background = C.badSoft}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        aria-label="delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function DayBars({ days, onTap }) {
  const { t } = useT();
  const fmt = useFmt();
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 font-semibold"
           style={{ color: C.inkMute }}>
        <BarChart3 className="w-3 h-3" /> {t('stats.ethanolByDay')}
      </div>
      <div className="h-32 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="dayLabel"
              stroke={C.inkMute}
              tick={{ fontSize: 9, fontFamily: 'DM Sans', fill: C.inkMute }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(days.length / 12) - 1)}
            />
            <YAxis
              stroke={C.inkMute}
              tick={{ fontSize: 9, fontFamily: 'DM Sans', fill: C.inkMute }}
              axisLine={false} tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: C.amberSoft }}
              contentStyle={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, fontFamily: 'DM Sans', fontSize: 11,
                color: C.ink, boxShadow: '0 4px 12px rgba(120,80,30,0.08)'
              }}
              formatter={(val, _, payload) => {
                const drinkLabel = plural('uk', payload.payload.drinks, { one: 'напій', few: 'напої', many: 'напоїв' });
                return [`${val.toFixed(1)} г · ${payload.payload.drinks} ${drinkLabel}`, fmt.dayShort(payload.payload.ms)];
              }}
              labelFormatter={() => ''}
            />
            <Bar
              dataKey="grams" radius={[3, 3, 0, 0]}
              onClick={(d) => d.drinks > 0 && onTap(d.ms)}
              cursor="pointer"
            >
              {days.map((d, i) => (
                <Cell key={i} fill={d.grams > 0 ? C.amber : '#f0e3c8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ====== DAY DETAIL ======
function DayDetailScreen({ dayMs, drinks, onBack, onRemove, onEdit, editingDrink, onCloseEdit, onSaveEdit }) {
  const { t, locale } = useT();
  const fmt = useFmt();
  const totalAlc = drinks.reduce((s, x) => s + alcoholGrams(x.volumeMl, x.alcoholPct), 0);
  const totalVol = drinks.reduce((s, x) => s + x.volumeMl, 0);
  const sorted = [...drinks].sort((a, b) => a.timestamp - b.timestamp);

  const drinkLabel = plural(locale, drinks.length, t('drinkCount'));

  return (
    <div className="min-h-screen"
         style={{ background: C.bg, color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        .num-tabular { font-variant-numeric: tabular-nums; }
        .card { background: ${C.card}; border: 1px solid ${C.border};
                box-shadow: 0 1px 2px rgba(120,80,30,0.04); }
      `}</style>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={onBack}
          className="card rounded-full pl-2 pr-3 py-2 text-xs flex items-center gap-1 transition active:scale-95 font-semibold mb-5"
          style={{ color: C.inkSoft }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#fff8eb'}
          onMouseLeave={(e) => e.currentTarget.style.background = C.card}
        >
          <ChevronLeft className="w-4 h-4" /> {t('stats.back')}
        </button>

        <h1 className="text-2xl font-bold tracking-tight mb-1 capitalize" style={{ color: C.ink }}>
          {fmt.dayLong(dayMs)}
        </h1>
        <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
          {drinks.length} {drinkLabel}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <Stat label={t('stats.drinks')} value={drinks.length} />
          <Stat label={t('stats.volumeMl')} value={totalVol.toFixed(0)} />
          <Stat label={t('stats.alcoholG')} value={totalAlc.toFixed(0)} highlight />
        </div>

        <div className="card rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-wider mb-3 px-1 font-semibold" style={{ color: C.inkMute }}>
            {t('stats.timeline')}
          </div>
          <div className="space-y-1">
            {sorted.map(d => (
              <DrinkRow key={d.id} drink={d} onRemove={() => onRemove(d.id)} onEdit={() => onEdit(d)} />
            ))}
          </div>
          <p className="text-[10px] mt-3 px-1" style={{ color: C.inkMute }}>{t('stats.tapToEdit')}</p>
        </div>
      </div>

      {editingDrink && (
        <EditDrinkModal
          drink={editingDrink}
          onClose={onCloseEdit}
          onSave={onSaveEdit}
          onDelete={() => { onRemove(editingDrink.id); onCloseEdit(); }}
        />
      )}
    </div>
  );
}

// ====== CONSENT ======
function ConsentScreen({ onAccept }) {
  const { t } = useT();
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8"
         style={{ background: C.bg, color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="rounded-3xl p-7 sm:p-9 max-w-md w-full"
           style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(120,80,30,0.06)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5 mx-auto"
             style={{ background: C.amberSoft }}>
          <ShieldAlert className="w-6 h-6" style={{ color: C.amberDeep }} />
        </div>
        <h1 className="text-3xl text-center mb-2 font-bold tracking-tight" style={{ color: C.ink }}>{t('consent.title')}</h1>
        <p className="text-center text-sm mb-6" style={{ color: C.inkSoft }}>{t('consent.subtitle')}</p>

        <div className="space-y-3 text-sm leading-relaxed" style={{ color: C.inkSoft }}>
          <p dangerouslySetInnerHTML={{ __html: t('consent.adultOnly') }} />
          <p dangerouslySetInnerHTML={{ __html: t('consent.estimateOnly') }} />
          <p dangerouslySetInnerHTML={{ __html: t('consent.notForDriving') }} />
          <p className="text-xs pt-3" style={{ color: C.inkMute, borderTop: `1px solid ${C.border}` }}>
            {t('consent.acceptHint')}
          </p>
        </div>

        <button
          onClick={onAccept}
          className="w-full mt-6 py-3.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${C.amber}, ${C.amberDeep})`, color: '#fff8eb' }}
        >
          <Check className="w-4 h-4" /> {t('consent.accept')}
        </button>
      </div>
    </div>
  );
}

// ====== PROFILE MODAL ======
function ProfileModal({ profile, onClose, onSave, firstRun }) {
  const { t } = useT();
  const [gender, setGender] = useState(profile.gender);
  const [weight, setWeight] = useState(profile.weight);
  const [legalLimit, setLegalLimit] = useState(profile.legalLimit);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(60,40,15,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-7"
           style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(60,40,15,0.2)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.ink }}>
            {firstRun ? t('profile.tellAboutYou') : t('profile.title')}
          </h2>
          {!firstRun && (
            <button onClick={onClose} className="p-2 rounded-full transition"
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5ead0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <X className="w-4 h-4" style={{ color: C.inkSoft }} />
            </button>
          )}
        </div>
        <p className="text-xs mb-6" style={{ color: C.inkSoft }}>{t('profile.reason')}</p>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.inkSoft }}>{t('profile.gender')}</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { id: 'male', label: t('profile.male') },
                { id: 'female', label: t('profile.female') }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setGender(opt.id)}
                  className="py-2.5 rounded-xl text-sm transition font-semibold"
                  style={
                    gender === opt.id
                      ? { background: C.ink, color: C.bg }
                      : { background: '#f5ead0', color: C.inkSoft }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.inkSoft }}>
              {t('profile.weight', { w: weight })}
            </label>
            <input
              type="range" min="40" max="150" value={weight}
              onChange={e => setWeight(+e.target.value)}
              className="w-full mt-2"
              style={{ accentColor: C.amberDeep }}
            />
            <div className="flex justify-between text-[10px] num-tabular mt-1 font-medium" style={{ color: C.inkMute }}>
              <span>{t('profile.weightMin')}</span><span>{t('profile.weightMax')}</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.inkSoft }}>{t('profile.legalLimit')}</label>
            <div className="grid grid-cols-4 gap-1.5 mt-2 text-xs">
              {[0.0, 0.2, 0.5, 0.8].map(v => (
                <button
                  key={v}
                  onClick={() => setLegalLimit(v)}
                  className="py-2 rounded-lg num-tabular transition font-semibold"
                  style={
                    legalLimit === v
                      ? { background: C.ink, color: C.bg }
                      : { background: '#f5ead0', color: C.inkSoft }
                  }
                >
                  {v.toFixed(1)} ‰
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: C.inkMute }}>{t('profile.countryHint')}</p>
          </div>
        </div>

        <button
          onClick={() => onSave({ gender, weight, legalLimit })}
          className="w-full mt-7 py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${C.amber}, ${C.amberDeep})`, color: '#fff8eb' }}
        >
          <Check className="w-4 h-4" /> {t('profile.save')}
        </button>
      </div>
    </div>
  );
}

// ====== CUSTOM DRINK MODAL ======
function CustomDrinkModal({ onClose, onAdd }) {
  const { t } = useT();
  const [name, setName] = useState(t('custom.defaultName'));
  const [volumeMl, setVolumeMl] = useState(330);
  const [alcoholPct, setAlcoholPct] = useState(5);
  const [whenMs, setWhenMs] = useState(Date.now());
  const [icon, setIcon] = useState('🥃');
  const [savePreset, setSavePreset] = useState(false);

  const grams = alcoholGrams(volumeMl, alcoholPct);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(60,40,15,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-7 max-h-[95vh] overflow-y-auto"
           style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(60,40,15,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.ink }}>{t('custom.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full transition"
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5ead0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <X className="w-4 h-4" style={{ color: C.inkSoft }} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label={t('custom.icon')}>
            <IconPicker value={icon} onChange={setIcon} />
          </Field>

          <Field label={t('custom.name')}>
            <TextInput value={name} onChange={setName} />
          </Field>

          <Field label={t('custom.volume', { v: volumeMl })}>
            <input type="range" min="20" max="1000" step="10" value={volumeMl}
                   onChange={e => setVolumeMl(+e.target.value)}
                   className="w-full" style={{ accentColor: C.amberDeep }} />
          </Field>

          <Field label={t('custom.strength', { p: alcoholPct })}>
            <input type="range" min="0.5" max="60" step="0.5" value={alcoholPct}
                   onChange={e => setAlcoholPct(+e.target.value)}
                   className="w-full" style={{ accentColor: C.amberDeep }} />
          </Field>

          <Field label={t('time.title')}>
            <DateTimeQuickPicker value={whenMs} onChange={setWhenMs} />
          </Field>

          <PureAlcoholBox grams={grams} />

          <label className="flex items-center gap-2.5 p-2 cursor-pointer select-none">
            <input type="checkbox" checked={savePreset}
                   onChange={e => setSavePreset(e.target.checked)}
                   className="w-4 h-4 rounded" style={{ accentColor: C.amberDeep }} />
            <span className="text-sm" style={{ color: C.inkSoft }}>{t('custom.savePreset')}</span>
          </label>
        </div>

        <PrimaryButton onClick={() => onAdd({ name, volumeMl, alcoholPct, icon }, whenMs, savePreset)}>
          <Plus className="w-4 h-4" /> {t('custom.add')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ====== EDIT DRINK MODAL ======
function EditDrinkModal({ drink, onClose, onSave, onDelete }) {
  const { t } = useT();
  const [name, setName] = useState(drink.name || '');
  const [volumeMl, setVolumeMl] = useState(drink.volumeMl);
  const [alcoholPct, setAlcoholPct] = useState(drink.alcoholPct);
  const [whenMs, setWhenMs] = useState(drink.timestamp);
  const [icon, setIcon] = useState(drink.icon || '🥃');

  const grams = alcoholGrams(volumeMl, alcoholPct);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(60,40,15,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-7 max-h-[95vh] overflow-y-auto"
           style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(60,40,15,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.ink }}>{t('edit.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full transition"
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5ead0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <X className="w-4 h-4" style={{ color: C.inkSoft }} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label={t('custom.icon')}>
            <IconPicker value={icon} onChange={setIcon} />
          </Field>

          <Field label={t('custom.name')}>
            <TextInput value={name} onChange={setName} />
          </Field>

          <Field label={t('custom.volume', { v: volumeMl })}>
            <input type="range" min="20" max="1000" step="10" value={volumeMl}
                   onChange={e => setVolumeMl(+e.target.value)}
                   className="w-full" style={{ accentColor: C.amberDeep }} />
          </Field>

          <Field label={t('custom.strength', { p: alcoholPct })}>
            <input type="range" min="0.5" max="60" step="0.5" value={alcoholPct}
                   onChange={e => setAlcoholPct(+e.target.value)}
                   className="w-full" style={{ accentColor: C.amberDeep }} />
          </Field>

          <Field label={t('time.title')}>
            <DateTimeQuickPicker value={whenMs} onChange={setWhenMs} />
          </Field>

          <PureAlcoholBox grams={grams} />
        </div>

        <PrimaryButton onClick={() => onSave({ name, volumeMl, alcoholPct, icon, timestamp: whenMs })}>
          <Check className="w-4 h-4" /> {t('edit.save')}
        </PrimaryButton>

        <button
          onClick={() => { if (confirm(t('edit.delete') + '?')) onDelete(); }}
          className="w-full mt-2 py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
          style={{ background: 'transparent', color: C.bad, border: `1px solid ${C.badSoft}` }}
        >
          <Trash2 className="w-4 h-4" /> {t('edit.delete')}
        </button>
      </div>
    </div>
  );
}

// ====== TIME PICKER (preset → past) ======
function TimePickerModal({ preset, onClose, onAdd }) {
  const { t } = useT();
  const [whenMs, setWhenMs] = useState(Date.now());
  const isMl = !t('stats.volumeMl').includes('ml');
  const mlLabel = isMl ? 'мл' : 'ml';
  const gLabel = t('stats.alcoholG').includes('Alc') ? 'g' : 'г';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(60,40,15,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-7"
           style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(60,40,15,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: C.ink }}>{t('time.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full transition"
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5ead0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <X className="w-4 h-4" style={{ color: C.inkSoft }} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: '#f5ead0' }}>
          <div className="text-2xl">{preset.icon || '🥃'}</div>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>{preset.name}</div>
            <div className="text-[11px] num-tabular font-medium" style={{ color: C.inkMute }}>
              {preset.volumeMl} {mlLabel} · {preset.alcoholPct}% · {alcoholGrams(preset.volumeMl, preset.alcoholPct).toFixed(1)} {gLabel}
            </div>
          </div>
        </div>

        <DateTimeQuickPicker value={whenMs} onChange={setWhenMs} />

        <PrimaryButton onClick={() => onAdd(whenMs)}>
          <Plus className="w-4 h-4" /> {t('time.addToJournal')}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ====== DATE+TIME QUICK PICKER ======
function DateTimeQuickPicker({ value, onChange }) {
  const { t } = useT();
  const fmtRel = useFmtRelative();

  const presets = [
    { label: t('time.now'),         ms: () => Date.now() },
    { label: t('time.m30'),         ms: () => Date.now() - 30 * 60000 },
    { label: t('time.h2'),          ms: () => Date.now() - 2 * 3600000 },
    { label: t('time.yesterday20'), ms: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(20, 0, 0, 0);
      return d.getTime();
    }},
    { label: t('time.weekAgo'),     ms: () => Date.now() - 7 * 86400000 },
  ];

  const isPresetActive = (preset) => Math.abs(value - preset.ms()) < 60000;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = isPresetActive(p);
          return (
            <button
              key={p.label}
              onClick={() => onChange(p.ms())}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition active:scale-95"
              style={
                active
                  ? { background: C.ink, color: C.bg }
                  : { background: '#f5ead0', color: C.inkSoft }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <input
        type="datetime-local"
        value={toLocalInput(value)}
        max={toLocalInput(Date.now())}
        onChange={(e) => { if (e.target.value) onChange(fromLocalInput(e.target.value)); }}
        className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none num-tabular"
        style={{
          background: '#f5ead0', border: '1px solid transparent',
          color: C.ink, colorScheme: 'light'
        }}
        onFocus={(e) => { e.target.style.borderColor = C.amber; e.target.style.background = '#fff'; }}
        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#f5ead0'; }}
      />

      <div className="text-[11px] text-center font-medium" style={{ color: C.inkSoft }}>
        {fmtRel(value)}
      </div>
    </div>
  );
}

// ====== SHARED FIELD HELPERS ======
const Field = ({ label, children }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider block mb-2 font-semibold" style={{ color: C.inkSoft }}>
      {label}
    </label>
    {children}
  </div>
);

function IconPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DRINK_ICONS.map(em => (
        <button
          key={em}
          onClick={() => onChange(em)}
          className="w-10 h-10 rounded-lg text-xl transition"
          style={value === em ? { background: C.ink } : { background: '#f5ead0' }}
        >
          {em}
        </button>
      ))}
    </div>
  );
}

function TextInput({ value, onChange }) {
  return (
    <input
      type="text" value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
      style={{ background: '#f5ead0', border: '1px solid transparent', color: C.ink }}
      onFocus={(e) => { e.target.style.borderColor = C.amber; e.target.style.background = '#fff'; }}
      onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#f5ead0'; }}
    />
  );
}

function PureAlcoholBox({ grams }) {
  const { t } = useT();
  const gLabel = t('stats.alcoholG').includes('Alc') ? 'g' : 'г';
  return (
    <div className="rounded-xl p-3 flex justify-between items-center" style={{ background: '#f5ead0' }}>
      <span className="text-xs font-medium" style={{ color: C.inkSoft }}>{t('custom.pureAlcohol')}</span>
      <span className="num-tabular text-lg font-bold" style={{ color: C.ink }}>
        {grams.toFixed(1)} {gLabel}
      </span>
    </div>
  );
}

function PrimaryButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-5 py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
      style={{ background: `linear-gradient(135deg, ${C.amber}, ${C.amberDeep})`, color: '#fff8eb' }}
    >
      {children}
    </button>
  );
}
