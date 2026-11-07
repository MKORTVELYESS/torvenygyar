// Internationalization via i18next — the de-facto standard JS i18n library,
// used here with inline resource bundles (no build step / backend needed).
import i18next from 'https://cdn.jsdelivr.net/npm/i18next@23/+esm';

const STORAGE_KEY = 'mk-viz-lang';

const en = {
  eyebrow: 'Magyar Közlöny · Official Gazette of Hungary',
  lang: { en: 'EN', hu: 'HU' },
  view: {
    tower: {
      label: 'Paper tower',
      title: 'How tall is the law?',
      lede: 'Every published page stacked as a sheet of A4 paper, compared with things you know.',
    },
    night: {
      label: 'Office hours',
      title: 'Under the cover of night?',
      lede: 'The office hours of the law factory, read from the creation date of the issue PDF.',
    },
  },
  granularity: {
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
    half: 'Half-yearly', yearly: 'Yearly', government: 'Governments', alltime: 'All time',
  },
  unit: {
    day: 'day', week: 'week', month: 'month', quarter: 'quarter',
    'half-year': 'half-year', year: 'year', government: 'government', 'all-time': 'all-time',
  },
  toolbar: {
    scroll: 'Scroll', scrollHint: '↓ coarser · ↑ finer',
    shift: 'Shift', shiftHint: '+ scroll or drag to pan',
  },
  axis: { height: 'HEIGHT', releaseTime: 'RELEASE TIME' },
  stats: {
    pagesPublished: 'Pages published',
    issuesSuffix: '{{count}} issues',
    allTimeStack: 'All-time stack',
    sheetsNote: 'A4 sheets at 0.1 mm each',
    tallest: 'Tallest {{unit}}',
    comparedTo: 'Compared to',
    comparedToSub: '{{height}} · tallest tower is {{ratio}} of it',
    releasesAnalyzed: 'Releases analyzed',
    pagesTotalSuffix: '{{count}} pages total',
    allTimeAverage: 'All-time average',
    meanPublicationTime: 'mean publication time',
    latestAvg: 'Latest avg {{unit}}',
    noDataInRange: 'no data in range',
    typicalMood: 'Typical mood',
    avgReleaseAt: 'avg release at {{time}}',
  },
  tooltip: {
    pages: 'Pages', issues: 'Issues', stackHeight: 'Stack height', vs: 'vs. {{name}}',
    avg: 'Avg', median: 'Median', stdDeviation: 'Std deviation',
    p10: '10th percentile', p25: '25th percentile', p75: '75th percentile', p90: '90th percentile',
    noIssues: 'No issues',
  },
  candle: {
    link: 'Interpreting the candle chart',
    modalTitle: 'Interpreting the candle chart',
    modalIntro: 'Each candle summarizes release times for its bucket using four percentiles:',
    p10: '10% of the issues were released before this time',
    p25: 'Three quarters of the issues were released after this time',
    p75: 'A quarter of the issues were released after this time',
    p90: 'A tenth of the issues were released after this time',
  },
  mood: {
    sleep: 'Burning midnight oil', dawn: 'Early riser', day: 'Office hours',
    dusk: 'Overtime clerk', night: 'Night-shift nap', unknown: 'Unknown',
  },
  object: {
    rubik: "Rubik's Cube", mug: 'Coffee mug', phone: 'Smartphone', wine: 'Wine bottle',
    hydrant: 'Fire hydrant', chair: 'Kitchen chair', person: 'Adult person', bus: 'Double-decker bus',
    house: 'Family house', tree: 'Oak tree', panel: 'Ten-storey panel block',
    basilica: "St. Stephen's Basilica",
  },
  footer: {
    source: 'Source: PDF metadata of magyarkozlony.hu issues (creation date, page count). '
      + 'One page = one 80 g/m² A4 sheet ≈ 0.1 mm. Early issues were digitized in batches, so their dates cluster.',
  },
  dash: {
    eyebrow: 'Government comparison',
    title: 'Full throttle',
    lede: 'Speed is pages per day; RPM is issues per day. The premiership closest to the all-time '
      + 'average pace is pinned at a steady 130 km/h, and everyone else is scaled against it.',
    allTimeAverage: 'All-time average',
    pagesPerDay: 'pages / day',
    issuesPerDay: 'issues / day',
    reference: 'Reference · {{speed}} km/h',
  },
  disclaimer: '“All-time” throughout this page means since digital record-keeping began, in 1998 — '
    + 'not the Gazette’s full history back to 1867.',
  allTimeArchive: 'The entire digitised Magyar Közlöny archive',
  error: { loadFailed: 'Could not load results.csv ({{message}})', noData: 'results.csv has no dated rows yet.' },
};

const hu = {
  eyebrow: 'Magyar Közlöny · Magyarország hivatalos lapja',
  lang: { en: 'EN', hu: 'HU' },
  view: {
    tower: {
      label: 'Papírtorony',
      title: 'Milyen magas a törvény?',
      lede: 'Minden megjelent oldal egy A4-es lapként egymásra tornyozva, ismerős dolgokhoz mérve.',
    },
    night: {
      label: 'Munkaidő',
      title: 'Az éjszaka leple alatt?',
      lede: 'A jogalkotó gyár munkarendje, a kiadványok PDF-jének létrehozási dátuma alapján.',
    },
  },
  granularity: {
    daily: 'Napi', weekly: 'Heti', monthly: 'Havi', quarterly: 'Negyedéves',
    half: 'Féléves', yearly: 'Éves', government: 'Kormányok', alltime: 'Teljes időszak',
  },
  unit: {
    day: 'nap', week: 'hét', month: 'hónap', quarter: 'negyedév',
    'half-year': 'félév', year: 'év', government: 'kormány', 'all-time': 'teljes időszak',
  },
  toolbar: {
    scroll: 'Görgetés', scrollHint: '↓ durvább · ↑ finomabb',
    shift: 'Shift', shiftHint: '+ görgetés vagy húzás a mozgatáshoz',
  },
  axis: { height: 'MAGASSÁG', releaseTime: 'MEGJELENÉS IDEJE' },
  stats: {
    pagesPublished: 'Megjelent oldalak',
    issuesSuffix: '{{count}} szám',
    allTimeStack: 'Teljes magasság',
    sheetsNote: 'A4-es lap, egyenként 0,1 mm',
    tallest: 'Legmagasabb {{unit}}',
    comparedTo: 'Összehasonlítva',
    comparedToSub: '{{height}} · a legmagasabb torony ennek {{ratio}}-a',
    releasesAnalyzed: 'Vizsgált megjelenések',
    pagesTotalSuffix: '{{count}} oldal összesen',
    allTimeAverage: 'Mindenkori átlag',
    meanPublicationTime: 'átlagos megjelenési időpont',
    latestAvg: 'Legkésőbbi átlag ({{unit}})',
    noDataInRange: 'nincs adat',
    typicalMood: 'Jellemző hangulat',
    avgReleaseAt: 'átlagosan {{time}}-kor',
  },
  tooltip: {
    pages: 'Oldalak', issues: 'Számok', stackHeight: 'Toronymagasság', vs: '{{name}}-hoz képest',
    avg: 'Átlag', median: 'Medián', stdDeviation: 'Szórás',
    p10: '10. percentilis', p25: '25. percentilis', p75: '75. percentilis', p90: '90. percentilis',
    noIssues: 'Nincs megjelenés',
  },
  candle: {
    link: 'Hogyan olvassuk a gyertyadiagramot',
    modalTitle: 'Hogyan olvassuk a gyertyadiagramot',
    modalIntro: 'Minden gyertya négy percentilissel foglalja össze az adott időszak megjelenési időpontjait:',
    p10: 'A számok 10%-a ez előtt az időpont előtt jelent meg',
    p25: 'A számok háromnegyede ez után az időpont után jelent meg',
    p75: 'A számok negyede ez után az időpont után jelent meg',
    p90: 'A számok tizede ez után az időpont után jelent meg',
  },
  mood: {
    sleep: 'Éjszakába nyúló munka', dawn: 'Korán kelő', day: 'Munkaidő',
    dusk: 'Túlóra', night: 'Éjszakai szunyókálás', unknown: 'Ismeretlen',
  },
  object: {
    rubik: 'Rubik-kocka', mug: 'Kávésbögre', phone: 'Okostelefon', wine: 'Borosüveg',
    hydrant: 'Tűzcsap', chair: 'Konyhaszék', person: 'Felnőtt ember', bus: 'Emeletes busz',
    house: 'Családi ház', tree: 'Tölgyfa', panel: 'Tízemeletes panelház',
    basilica: 'Szent István-bazilika',
  },
  footer: {
    source: 'Forrás: a magyarkozlony.hu számainak PDF-metaadatai (létrehozási dátum, oldalszám). '
      + 'Egy oldal = egy 80 g/m²-es A4-es lap ≈ 0,1 mm. A korai számokat kötegelve digitalizálták, '
      + 'ezért a dátumaik csomókba tömörülnek.',
  },
  dash: {
    eyebrow: 'Kormányok összehasonlítása',
    title: 'Teljes gázzal',
    lede: 'A sebesség a napi oldalszámot, a fordulatszám a napi számmennyiséget jelenti. A mindenkori '
      + 'átlaghoz legközelebb álló miniszterelnökség van rögzítve stabil 130 km/h-n, mindenki más ehhez van skálázva.',
    allTimeAverage: 'Mindenkori átlag',
    pagesPerDay: 'oldal / nap',
    issuesPerDay: 'szám / nap',
    reference: 'Viszonyítási alap · {{speed}} km/h',
  },
  disclaimer: 'A „mindenkori / teljes időszak” kifejezés ezen az oldalon azóta értendő, amióta a digitális nyilvántartás '
    + 'elkezdődött, 1998-ban — nem a Közlöny teljes, 1867-ig visszanyúló történetét jelenti.',
  allTimeArchive: 'A Magyar Közlöny teljes digitalizált archívuma',
  error: {
    loadFailed: 'Nem sikerült betölteni a results.csv fájlt ({{message}})',
    noData: 'A results.csv még nem tartalmaz dátumozott sorokat.',
  },
};

export function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const lng = saved === 'hu' ? 'hu' : 'en';
  return i18next.init({
    lng,
    fallbackLng: 'en',
    resources: { en: { translation: en }, hu: { translation: hu } },
    interpolation: { escapeValue: false },
  });
}

export const t = (key, options) => i18next.t(key, options);

export const getLang = () => i18next.language;

export async function setLang(lang) {
  await i18next.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
}

/** Updates every element with a data-i18n attribute to the current language. */
export function applyStaticTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}
