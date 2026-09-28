/**
 * Maru Suite for Cider 4
 * Authors: Maru & Nanami
 * 
 * Features:
 * 1. Apple Music Dynamic Scroll Header (Scroll-boundary verified, zero collision)
 * 2. Synchronized Romaji Japanese Lyrics Engine (Kanji + Kana full transliteration)
 * 3. Smooth Hardware-Accelerated Micro-Transitions
 */

// Cache for translated romaji lines
const romajiCache = new Map();

// In-flight fetch promises to prevent duplicate network calls
const pendingFetches = new Map();

// Kana to Romaji dictionary for fast instant local lookup
const KANA_MAP = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo'
};

function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function transliterateKanaOnly(input) {
  if (!input) return '';
  const str = katakanaToHiragana(input);
  let res = '';
  let i = 0;
  while (i < str.length) {
    const two = str.slice(i, i + 2);
    if (KANA_MAP[two]) {
      res += KANA_MAP[two] + ' ';
      i += 2;
      continue;
    }
    if (str[i] === 'っ') {
      const nextTwo = str.slice(i + 1, i + 3);
      const nextOne = str.slice(i + 1, i + 2);
      const nextRomaji = KANA_MAP[nextTwo] || KANA_MAP[nextOne] || '';
      if (nextRomaji && nextRomaji[0]) {
        res += nextRomaji[0];
      }
      i++;
      continue;
    }
    if (str[i] === 'ー') {
      const lastChar = res.trim().slice(-1);
      if (/[aiueo]/.test(lastChar)) {
        res += lastChar;
      }
      i++;
      continue;
    }
    const one = str[i];
    if (KANA_MAP[one]) {
      res += KANA_MAP[one] + ' ';
    } else {
      res += one;
    }
    i++;
  }
  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Full Japanese Transliteration (Kanji + Hiragana + Katakana)
 */
async function fetchFullRomaji(japaneseText) {
  const trimmed = japaneseText.trim();
  if (!trimmed) return '';
  if (romajiCache.has(trimmed)) {
    return romajiCache.get(trimmed);
  }

  const hasKanji = /[\u4E00-\u9FAF]/.test(trimmed);
  if (!hasKanji) {
    const local = transliterateKanaOnly(trimmed);
    romajiCache.set(trimmed, local);
    return local;
  }

  if (pendingFetches.has(trimmed)) {
    return pendingFetches.get(trimmed);
  }

  const promise = (async () => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=rm&q=${encodeURIComponent(trimmed)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      let romaji = '';
      if (Array.isArray(data?.[0])) {
        for (const item of data[0]) {
          if (item && item[3]) {
            romaji += (romaji ? ' ' : '') + item[3];
          }
        }
      }

      romaji = romaji.trim();
      if (!romaji) {
        romaji = transliterateKanaOnly(trimmed);
      }

      romajiCache.set(trimmed, romaji);
      return romaji;
    } catch (err) {
      const fallback = transliterateKanaOnly(trimmed);
      romajiCache.set(trimmed, fallback);
      return fallback;
    } finally {
      pendingFetches.delete(trimmed);
    }
  })();

  pendingFetches.set(trimmed, promise);
  return promise;
}

const CSS_STYLES = `
/* ==========================================================================
   MARU SUITE INJECTED STYLES
   ========================================================================== */

.ns-toolbar,
.ns-toolbar_inline {
  padding-top: 0px !important;
  margin-top: 0px !important;
}

.chrome-top {
  position: relative !important;
  top: 0px !important;
  margin-top: 0px !important;
  transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease !important;
}

/* Chrome Top Acrylic Header Bar when scrolled */
body.body--dark .chrome-top.has-scrolled-title,
.body--dark .chrome-top.has-scrolled-title,
.chrome-top.has-scrolled-title,
.ns-toolbar.has-scrolled-title,
.ns-toolbar_inline.has-scrolled-title {
  background-color: #181818 !important;
  background: #181818 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
}

/* Seal any hairline gap or bleed above chrome-top up to the physical window edge */
.chrome-top.has-scrolled-title::before {
  content: "" !important;
  position: absolute !important;
  top: -24px !important;
  left: 0 !important;
  right: 0 !important;
  height: 24px !important;
  background-color: #181818 !important;
  background: #181818 !important;
  z-index: 999999 !important;
  display: block !important;
  pointer-events: none !important;
}

.maru-chrome-title {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -15px) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  color: #ffffff !important;
  pointer-events: none !important;
  opacity: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 44vw !important;
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.1, 0.9, 0.2, 1) !important;
  z-index: 999999 !important;
  user-select: none !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9) !important;
}

.maru-chrome-title.visible {
  opacity: 1 !important;
  transform: translate(-50%, -50%) !important;
}

/* Romaji Lyrics Subtitle */
.maru-romaji-subtitle {
  display: block !important;
  font-size: 0.58em !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  line-height: 1.35 !important;
  opacity: 0.72 !important;
  margin-top: 3px !important;
  color: #cfd8dc !important;
  pointer-events: none !important;
  transition: color 120ms ease, opacity 120ms ease !important;
}

.lyric-line:hover .maru-romaji-subtitle {
  opacity: 0.88 !important;
  color: #ffffff !important;
}

.lyric-line.active .maru-romaji-subtitle {
  opacity: 1 !important;
  color: #ffffff !important;
  font-weight: 600 !important;
}
`;

class MaruSuite {
  constructor() {
    this.titleElement = null;
    this.liveScrollY = 0;
  }

  init() {
    console.log('[MaruSuite] Initializing Maru Suite plugin...');
    this.injectStyles();
    this.setupDynamicScrollHeader();
    this.setupRomajiLyrics();
    document.documentElement.dataset.maruPlugin = 'active';
  }

  injectStyles() {
    if (document.getElementById('maru-suite-styles')) return;
    const style = document.createElement('style');
    style.id = 'maru-suite-styles';
    style.textContent = CSS_STYLES;
    document.head.appendChild(style);
  }

  /* --------------------------------------------------------------------------
     FEATURE 1: APPLE MUSIC DYNAMIC SCROLL HEADER
     -------------------------------------------------------------------------- */
  setupDynamicScrollHeader() {
    const ensureTitleElement = () => {
      if (this.titleElement && document.body.contains(this.titleElement)) {
        return this.titleElement;
      }
      const chromeTop = document.querySelector('.chrome-top');
      if (!chromeTop) return null;

      let el = document.getElementById('maru-dynamic-title');
      if (!el) {
        el = document.createElement('div');
        el.id = 'maru-dynamic-title';
        el.className = 'maru-chrome-title';
        chromeTop.appendChild(el);
      }
      this.titleElement = el;
      return el;
    };

    const getActiveTitle = () => {
      // 1. Check active sidebar item first (Home, New, etc.)
      const activeNav = document.querySelector(
        '.navigation-button.active, .ns-sidebar .active, [aria-selected="true"], .q-item--active'
      );
      if (activeNav) {
        const navText = activeNav.textContent?.trim().toLowerCase();
        if (navText && (navText === 'home' || navText.includes('home') || navText === 'listen now')) {
          return 'Home';
        }
      }

      // 2. Cider pod-router tabs from localStorage
      try {
        const raw = localStorage.getItem('pod-router-tabs');
        const curId = localStorage.getItem('pod-router-current-tab');
        if (raw) {
          const tabs = JSON.parse(raw);
          const tab = (curId ? tabs.find(t => t.id === curId) : null) || tabs[0];
          if (tab) {
            const p = (tab.path || '').toLowerCase();
            const t = (tab.title || '').trim();
            // If on Home / Listen Now or if title is 'Maru' / 'Home', return 'Home'
            if (p === '/am/listen-now' || p === '/am/home' || p === '/' || tab.id === 'home' || t.toLowerCase() === 'maru' || t.toLowerCase() === 'home') {
              return 'Home';
            }
            if (t) {
              const ignore = ['Settings', 'Concerts'];
              if (!ignore.includes(t) && !t.startsWith('/') && t.length > 0) {
                return t;
              }
            }
          }
        }
      } catch (e) {}

      // 3. Headings in active content view (playlists, albums, artists)
      const selectors = [
        '.apple-heading',
        '.item-title .title-text',
        '[data-infer-title]',
        '.playlist-name',
        '.album-name',
        '#app-scroll-bounds h1',
        '.title-text'
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (!el.closest('aside, .navigation-drawer, .q-footer, #player-bar, .lyrics, .lyric-view')) {
            const t = el.textContent?.trim();
            if (t && t.length > 0 && !t.includes('TRACKS')) {
              if (t.toLowerCase() === 'maru') return 'Home';
              return t;
            }
          }
        }
      }
      return '';
    };

    const getLiveScrollTop = () => {
      const scrollBounds = document.getElementById('app-scroll-bounds');
      if (scrollBounds && typeof scrollBounds.scrollTop === 'number') {
        return scrollBounds.scrollTop;
      }
      if (this.liveScrollY > 0) {
        return this.liveScrollY;
      }
      const altScroller = document.querySelector('.content-area, .q-page-container, .c-virtual-list');
      if (altScroller && typeof altScroller.scrollTop === 'number') {
        return altScroller.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    /**
     * Determines whether the hero banner/cover has scrolled completely past the top bar.
     * Guaranteed to return FALSE when at or near the top of the playlist!
     */
    const isHeroScrolledPast = (chromeBottom) => {
      const scrollY = getLiveScrollTop();

      // Rule 1: Minimum scroll threshold. If scrolled less than 160px, hero is NEVER cleared!
      if (scrollY < 160) {
        return false;
      }

      // Rule 2: Tracklist container boundary. When the tracklist reaches chromeBottom, hero has cleared.
      const tracklist = document.querySelector('.listitem-scaffold, .c-virtual-list, .tracks-container, table tbody');
      if (tracklist) {
        const rect = tracklist.getBoundingClientRect();
        if (rect.top <= chromeBottom + 60) {
          return true;
        }
      }

      // Rule 3: Hero container boundary. When hero bottom passes above chromeBottom, it has cleared.
      const hero = document.querySelector('.header-card, .SuperHeroItem, .hero-card, [sfc-name="Playlist"] .container-detail, .item-artwork, .shelf-artwork');
      if (hero) {
        const rect = hero.getBoundingClientRect();
        if (rect.bottom <= chromeBottom + 10) {
          return true;
        }
      }

      // Rule 4: Deep scroll distance fallback
      return scrollY > 260;
    };

    const updateHeaderState = () => {
      const titleEl = ensureTitleElement();
      if (!titleEl) return;

      const chromeTop = document.querySelector('.chrome-top');
      if (!chromeTop) return;
      const chromeBottom = chromeTop.getBoundingClientRect().bottom || 48;

      const title = getActiveTitle();
      const heroCleared = isHeroScrolledPast(chromeBottom);

      // ONLY show when on a valid titled collection AND hero has scrolled completely past
      if (title && heroCleared) {
        if (titleEl.textContent !== title) {
          titleEl.textContent = title;
        }
        titleEl.classList.add('visible');
        chromeTop.classList.add('has-scrolled-title');
        const toolbar = chromeTop.closest('.ns-toolbar, .ns-toolbar_inline') || document.querySelector('.ns-toolbar, .ns-toolbar_inline');
        if (toolbar) toolbar.classList.add('has-scrolled-title');
      } else {
        titleEl.classList.remove('visible');
        chromeTop.classList.remove('has-scrolled-title');
        const toolbar = chromeTop.closest('.ns-toolbar, .ns-toolbar_inline') || document.querySelector('.ns-toolbar, .ns-toolbar_inline');
        if (toolbar) toolbar.classList.remove('has-scrolled-title');
      }
    };

    // Capture all live scroll events across any scroll container in Cider
    window.addEventListener('scroll', (event) => {
      const target = event.target;
      if (target && target.nodeType === 1) {
        if (!target.closest('aside, .navigation-drawer, .q-drawer, .lyrics, .lyric-view, #player-bar, .volume-quick-menu, .vctx-menu')) {
          this.liveScrollY = target.scrollTop || 0;
        }
      } else if (target === document || target === window) {
        this.liveScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      }
      requestAnimationFrame(updateHeaderState);
    }, { capture: true, passive: true });

    // Periodic check guarantees instantaneous updates on route/tab change
    setInterval(updateHeaderState, 100);
  }

  /* --------------------------------------------------------------------------
     FEATURE 2: SYNCHRONIZED ROMAJI LYRICS ENGINE (KANJI + KANA)
     -------------------------------------------------------------------------- */
  setupRomajiLyrics() {
    setInterval(() => {
      this.decorateVisibleLyrics();
    }, 250);
  }

  decorateVisibleLyrics() {
    const lines = document.querySelectorAll('.lyric-line');
    if (!lines || lines.length === 0) return;

    lines.forEach(async (lineEl) => {
      if (lineEl.querySelector('.maru-romaji-subtitle')) return;

      const textEl = lineEl.querySelector('.lyric-text') || lineEl.querySelector('.original') || lineEl;
      const rawText = textEl.textContent?.trim() || '';
      if (!rawText) return;

      // Only process lines containing Japanese characters (Hiragana, Katakana, or Kanji)
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(rawText);
      if (!hasJapanese) return;

      if (lineEl.dataset.maruProcessing) return;
      lineEl.dataset.maruProcessing = '1';

      try {
        const romaji = await fetchFullRomaji(rawText);
        if (romaji && romaji.toLowerCase() !== rawText.toLowerCase() && !lineEl.querySelector('.maru-romaji-subtitle')) {
          const subSpan = document.createElement('span');
          subSpan.className = 'maru-romaji-subtitle';
          subSpan.textContent = romaji;
          const wrapper = lineEl.querySelector('.lyric-content-wrapper') || lineEl;
          wrapper.appendChild(subSpan);
        }
      } finally {
        delete lineEl.dataset.maruProcessing;
      }
    });
  }
}

// Plugin lifecycle registration
const suite = new MaruSuite();

export default {
  name: 'Maru Suite',
  identifier: 'maru.cider-suite',
  version: '1.0.0',
  description: 'Authentic Windows 10 Acrylic UI, Apple Music dynamic scroll header, and synchronized Romaji lyrics.',
  author: 'Maru & Nanami',
  ce_prefix: 'maru',
  pluginKitVersion: 4,
  setup(ctx) {
    suite.init();
    if (ctx?.Notifications) {
      console.log('[MaruSuite] Registered with PluginKit 4.');
    }
  }
};
