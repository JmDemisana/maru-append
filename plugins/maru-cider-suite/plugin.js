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
      // Use clients5 dict-chrome-ex endpoint which is open, fast, and does NOT bot-block/captcha
      const url = `https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=ja&tl=en&dt=rm&q=${encodeURIComponent(trimmed)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
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
      } else {
        // Normalize macrons to natural Hepburn digraphs
        romaji = romaji
          .replace(/ō/g, 'ou')
          .replace(/Ō/g, 'Ou')
          .replace(/ū/g, 'uu')
          .replace(/Ū/g, 'Uu')
          .replace(/ā/g, 'aa')
          .replace(/Ā/g, 'Aa')
          .replace(/ē/g, 'ee')
          .replace(/Ē/g, 'Ee')
          .replace(/ī/g, 'ii')
          .replace(/Ī/g, 'Ii');
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
  left: 152px !important;
  top: 50% !important;
  transform: translateY(-50%) translateX(-8px) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  color: #ffffff !important;
  pointer-events: none !important;
  opacity: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 50vw !important;
  text-align: left !important;
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.1, 0.9, 0.2, 1) !important;
  z-index: 999999 !important;
  user-select: none !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9) !important;
}

.maru-chrome-title.visible {
  opacity: 1 !important;
  transform: translateY(-50%) translateX(0px) !important;
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

/* Hide Playlist & Album Header Pills */
.smart-meta,
.smart-meta__pill,
.meta-chip,
.meta-chips,
.item-tags,
.playlist-tags,
.header-meta .meta-chip,
.container-detail .meta-chip,
.container-detail .smart-meta,
.container-detail .item-tags,
.container-detail .tags,
.container-detail .chips,
[sfc-name="Playlist"] .smart-meta,
[sfc-name="Playlist"] .meta-chip,
[sfc-name="Playlist"] .item-tags,
[sfc-name="Playlist"] .tags {
  display: none !important;
}

/* Hide In-Album / In-Playlist Search */
#app-scroll-bounds .chrome-search,
#app-scroll-bounds .c-input-search,
#app-scroll-bounds .tracklist-toolbar,
#app-scroll-bounds .track-search,
#app-scroll-bounds .in-page-search,
#app-scroll-bounds .search-widget,
#app-scroll-bounds [class*="search"]:not(.search-box_container):not(#_top-search),
#app-scroll-bounds button:has([name*="search" i]),
#app-scroll-bounds button:has(svg[data-icon*="search" i]),
.chrome-search,
.chrome-search-input,
[data-v-61575f25],
.tracklist-toolbar .chrome-search,
.track-search,
.in-page-search,
[sfc-name="Playlist"] .chrome-search,
[sfc-name="Playlist"] [class*="search"],
.container-detail .chrome-search,
.playlist-header-container button:has(svg),
.rag-header button:has([name*="search" i]),
.rag-header button:has(svg) {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

/* Tracklist Row Stabilization */
.c-listitem,
.ri-list-item,
.tracklist-item,
.listitem-scaffold .c-listitem,
.q-virtual-scroll__content > .c-listitem {
  min-height: 46px !important;
  height: 46px !important;
  flex-shrink: 0 !important;
  box-sizing: border-box !important;
}

.rag-tracks > * {
  flex-shrink: 0 !important;
  min-height: 40px !important;
}

/* Remove Hover Controls (Play & Menu buttons on Discovery Station & Cards) */
.controls,
.controls[data-v-2a9a9088],
.controls-container,
.controls-container[data-v-2a9a9088],
.controls-container .c-btn,
.controls-container button,
.lockupControls,
.lockupControls.no-dim,
.lockupControls[data-v-3ce36cc0],
.lockupControls[data-v-e77cc759],
.lockupControls .menu,
.lockupControls .play,
.ri-shelf-item .lockupControls,
.ri-shelf-item:hover .lockupControls,
.ri-shelf-item:hover .lockupControls[data-v-3ce36cc0],
.powerswoosh .controls,
.powerswoosh:hover .controls,
.powerswoosh .controls-container,
.powerswoosh:hover .controls-container,
.mediaitem-card .controls,
.mediaitem-card .lockupControls,
[data-v-2a9a9088],
cider-lockup-controls {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

/* Bigger album shelves */
.ri-shelf {
  height: 310px !important;
  align-items: center !important;
}

.ri-shelf-item {
  position: relative !important;
  display: block !important;
  width: 270px !important;
  height: 270px !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  outline: none !important;
  overflow: hidden !important;
}

.mediaitem-card,
.mediaitem-grid .mediaitem-card {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  outline: none !important;
}

/* Sharp Consistent Metro Corners & Uniform Artwork Tiles */
.shelf-artwork,
.item-artwork,
.artwork-container,
.artwork,
.ri-shelf-artwork,
.category-brick,
.category-brick-artwork,
.powerswoosh {
  --itemRadius: 0px !important;
  --radius: 0px !important;
  --mediaItemRadiusMedium: 0px !important;
  --mediaItemRadiusRound: 0px !important;
  border-radius: 0px !important;
  corner-shape: unset !important;
  border: var(--w10-border, 1px solid rgba(255, 255, 255, 0.12)) !important;
  box-shadow: none !important;
  transition: transform 140ms cubic-bezier(0.1, 0.9, 0.2, 1), box-shadow 140ms ease, filter 140ms ease, border-color 140ms ease !important;
}

.ri-shelf-item .shelf-artwork,
.ri-shelf-item .ri-shelf-artwork {
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
  margin-bottom: 0px !important;
}

/* Progressive Black Title Overlay inside Album Tiles */
.ri-shelf-details {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 5 !important;
  padding: 38px 14px 12px 14px !important;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.72) 48%, rgba(0, 0, 0, 0.3) 80%, transparent 100%) !important;
  pointer-events: none !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-end !important;
}

.ri-shelf-details .item-name,
.ri-shelf-details .artistLink,
.ri-shelf-details * {
  color: #ffffff !important;
  pointer-events: auto !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9) !important;
}

.ri-shelf-details .item-name {
  font-size: 13.5px !important;
  font-weight: 600 !important;
  line-height: 1.25 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.ri-shelf-details .artistLink {
  font-size: 11.5px !important;
  opacity: 0.82 !important;
  margin-top: 3px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Windows 10 Reveal Highlight: light spotlights near mouse cursor */
.shelf-artwork::before,
.ri-shelf-artwork::before,
.powerswoosh::before,
.category-brick::before {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  background: radial-gradient(circle 140px at var(--mouse-x, -999px) var(--mouse-y, -999px), rgba(255, 255, 255, 0.22), transparent 75%) !important;
  opacity: 0 !important;
  transition: opacity 120ms ease !important;
  z-index: 6 !important;
}

.shelf-artwork:hover::before,
.ri-shelf-artwork:hover::before,
.powerswoosh:hover::before,
.category-brick:hover::before,
.ri-shelf-item:hover .ri-shelf-artwork::before {
  opacity: 1 !important;
}

/* Tactile 3px lift on hover */
.shelf-artwork:hover,
.item-artwork:hover,
.artwork-container:hover,
.ri-shelf-item:hover .shelf-artwork,
.ri-shelf-item:hover .ri-shelf-artwork,
.powerswoosh:hover,
.category-brick:hover {
  transform: translateY(-3px) !important;
  border-color: var(--w10-border-hover, rgba(255, 255, 255, 0.35)) !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.25) !important;
  filter: brightness(1.08) !important;
}

.shelf-artwork:active,
.item-artwork:active,
.artwork-container:active,
.ri-shelf-item:active .shelf-artwork,
.ri-shelf-item:active .ri-shelf-artwork,
.powerswoosh:active,
.category-brick:active {
  transform: translateY(0px) scale(0.99) !important;
  filter: brightness(0.96) !important;
}

.shelf-artwork img,
.item-artwork img,
.artwork img,
.q-img__image,
.powerswoosh img,
.category-brick img {
  border-radius: 0px !important;
}

/* Zero Blur & Player Title Expansion */
cider-lcdplayer-glass,
.lcd-player-glass {
  background: #181818 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.lcdplayer-info,
.lcdplayer-info[data-v-e06d297a],
.lcdplayer-info .amp-lcd-container,
.player-info,
.c-metadata,
.c-metadata .metadata-text {
  max-width: 580px !important;
  width: auto !important;
}

.c-metadata .song-name,
.c-metadata .release-info {
  max-width: 520px !important;
}

.c-metadata.title-overflows .song-name,
.c-metadata.subtitle-overflows .release-info {
  -webkit-mask-image: none !important;
  mask-image: none !important;
}



/* Fix Replay & Plattered Artwork Alignment */
.plattered-artwork {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

.plattered-artwork .plattered-artwork-container {
  width: 100% !important;
  height: 100% !important;
  aspect-ratio: unset !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

.plattered-artwork .plattered-artwork-container img,
.plattered-artwork img,
.powerswoosh .plattered-artwork img,
.powerswoosh img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: center !important;
  border-radius: 0px !important;
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
    this.setupPlaybackWatcher();
    this.setupPillRemover();
    this.setupRevealHighlight();
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
            // If on Home / Listen Now or if title is 'Maru' / 'Home' / greeting, return 'Home'
            if (p === '/am/listen-now' || p === '/am/home' || p === '/' || tab.id === 'home' || t.toLowerCase() === 'maru' || t.toLowerCase() === 'home' || /^good (morning|afternoon|evening)/i.test(t)) {
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
              if (t.toLowerCase() === 'maru' || t.toLowerCase() === 'listen now' || /^good (morning|afternoon|evening)/i.test(t)) return 'Home';
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

  /* --------------------------------------------------------------------------
     FEATURE 3: PLAYBACK STATE WATCHER (ANDROID SINE WAVE SYNC)
     -------------------------------------------------------------------------- */
  setupPlaybackWatcher() {
    const updatePlaybackState = () => {
      let isPlaying = false;

      // 1. Check HTML5 Audio elements
      const audios = document.querySelectorAll('audio');
      for (const a of audios) {
        if (!a.paused && a.currentTime > 0) {
          isPlaying = true;
          break;
        }
      }

      // 2. Check Cider PluginKit store
      if (!isPlaying) {
        try {
          const amStore = window.__PLUGINSYS__?.Stores?.appleMusicStore;
          if (amStore) {
            if (typeof amStore.isPlaying === 'boolean') {
              isPlaying = amStore.isPlaying;
            } else if (typeof amStore.playbackState === 'number') {
              isPlaying = amStore.playbackState === 2; // 2 = playing
            }
          }
        } catch (e) {}
      }

      // 3. Check CiderApp MusicKit player
      if (!isPlaying) {
        try {
          const mkPlayer = window.CiderApp?.musicKitStore?.player;
          if (mkPlayer) {
            if (typeof mkPlayer.isPlaying === 'boolean') {
              isPlaying = mkPlayer.isPlaying;
            } else if (typeof mkPlayer.playbackState === 'number') {
              isPlaying = mkPlayer.playbackState === 2;
            }
          }
        } catch (e) {}
      }

      // 4. DOM inspection fallback: look for active pause button in player controls
      if (!isPlaying) {
        const pauseBtn = document.querySelector(
          '.lcdplayer-controls [aria-label*="Pause" i], #player-bar [aria-label*="Pause" i], .lcdplayer-controls [title*="Pause" i], [data-icon*="pause" i], [aria-label*="pause" i]'
        );
        if (pauseBtn) {
          isPlaying = true;
        }
      }

      document.body.classList.toggle('maru-music-playing', isPlaying);
    };

    // Run interval
    setInterval(updatePlaybackState, 200);

    // Audio element listener binder
    const bindAudioEvents = () => {
      const audios = document.querySelectorAll('audio');
      audios.forEach(audio => {
        if (audio.dataset.maruBound) return;
        audio.dataset.maruBound = '1';
        audio.addEventListener('play', () => updatePlaybackState(), { passive: true });
        audio.addEventListener('playing', () => updatePlaybackState(), { passive: true });
        audio.addEventListener('pause', () => updatePlaybackState(), { passive: true });
        audio.addEventListener('ended', () => updatePlaybackState(), { passive: true });
      });
    };

    bindAudioEvents();
    setInterval(bindAudioEvents, 2000);
  }

  setupPillRemover() {
    const purgePills = () => {
      // 1. Selector-based hiding (safeguarding sidebar search and drawer)
      const selectors = [
        '.smart-meta',
        '.smart-meta__pill',
        '.meta-chip',
        '.meta-chips',
        '.item-tags',
        '.playlist-tags',
        '.container-detail .meta-chip',
        '.container-detail .smart-meta',
        '.container-detail .item-tags',
        '[sfc-name="Playlist"] .smart-meta',
        '[sfc-name="Playlist"] .meta-chip',
        '.tracklist-toolbar .chrome-search',
        '.lockupControls',
        '.lockup-controls',
        '.controls',
        '.controls-container',
        '.artwork-lockup',
        '.artwork-lockup-play',
        '[data-v-2a9a9088]'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (!el.closest('.settings, aside, .q-drawer, .q-footer, #player-bar, .sidebar-widget, .search-box_container')) {
            el.style.setProperty('display', 'none', 'important');
          }
        });
      });

      // 2. Generic sibling inspection immediately below playlist/album heading
      const headings = document.querySelectorAll(
        '.container-detail h1, .header-card h1, .item-info h1, [sfc-name="Playlist"] h1, h1.apple-heading'
      );
      headings.forEach(h => {
        let el = h.nextElementSibling;
        while (el && !el.matches('.description, .item-description, .actions-bar, .buttons, .playlist-actions, .listitem-scaffold, .tracks-container, table')) {
          const txt = el.textContent || '';
          if (txt.includes('TRACKS') || txt.includes('PERSONAL MIX') || txt.includes('TODAY') || el.classList.contains('smart-meta') || el.classList.contains('meta-chip') || el.querySelector('.smart-meta__pill, .meta-chip, [class*="chip"], [class*="pill"]')) {
            el.style.setProperty('display', 'none', 'important');
          }
          el = el.nextElementSibling;
        }
      });


      // 4. Ensure sidebar search bar is always visible
      const sidebarSearch = document.querySelector('.sidebar-widget.search-widget, .search-box_container');
      if (sidebarSearch) {
        sidebarSearch.style.removeProperty('display');
        sidebarSearch.style.setProperty('display', 'flex', 'important');
      }

      // 5. Hide the monthly "Your [Month] Replay here." card and handle portrait backdrop
      document.querySelectorAll('.powerswoosh').forEach(card => {
        const chin = card.querySelector('.powerswoosh-chin, .powerswoosh-lockup-detail');
        const text = (chin ? chin.textContent : card.textContent) || '';
        if (/replay here/i.test(text) || /your\s+\w+\s+replay/i.test(text)) {
          card.style.setProperty('display', 'none', 'important');
          card.style.setProperty('width', '0', 'important');
          card.style.setProperty('min-width', '0', 'important');
          card.style.setProperty('padding', '0', 'important');
          card.style.setProperty('margin', '0', 'important');
          card.style.setProperty('overflow', 'hidden', 'important');
          return;
        }

        const img = card.querySelector('.powerswoosh-artwork img, .plattered-artwork img, img');
        if (img && img.naturalWidth && img.naturalHeight) {
          const ratioKey = `${img.naturalWidth}x${img.naturalHeight}`;
          if (card.dataset.ratioSynced !== ratioKey) {
            card.dataset.ratioSynced = ratioKey;
            const ratio = img.naturalWidth / img.naturalHeight;
            card.style.setProperty('aspect-ratio', `${img.naturalWidth} / ${img.naturalHeight}`, 'important');
            const calcHeight = Math.round(260 / ratio);
            card.style.setProperty('height', `${calcHeight}px`, 'important');
            card.style.setProperty('min-height', `${calcHeight}px`, 'important');
            card.style.setProperty('max-height', `${calcHeight}px`, 'important');
          }
        }
      });

      // 6. Automatically purge in-album / in-playlist search button and inputs
      document.querySelectorAll(
        '#app-scroll-bounds .chrome-search, #app-scroll-bounds [class*="search"], #app-scroll-bounds input[type="search"], #app-scroll-bounds .tracklist-toolbar, #app-scroll-bounds button, #app-scroll-bounds .q-btn, #app-scroll-bounds .c-btn, #app-scroll-bounds [role="button"]'
      ).forEach(btn => {
        if (!btn.closest('.chrome-top, aside, .q-drawer, .q-footer, #player-bar, .command-center, .search-box_container, .sidebar-widget')) {
          const txt = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.className || btn.textContent || '').toLowerCase();
          const hasSearchIcon = btn.querySelector && btn.querySelector('[name*="search" i], [icon*="search" i], svg[data-icon*="search" i], .q-icon[name*="search" i]');
          const isSearchPillOrBar = btn.matches && (btn.matches('.chrome-search, input[type="search"], .tracklist-toolbar, .track-search, .in-page-search, [class*="search"]') || btn.classList?.contains('chrome-search'));
          if (hasSearchIcon || isSearchPillOrBar || (txt.includes('search') && !txt.includes('add to'))) {
            btn.style.setProperty('display', 'none', 'important');
            btn.style.setProperty('opacity', '0', 'important');
            btn.style.setProperty('visibility', 'hidden', 'important');
            btn.style.setProperty('pointer-events', 'none', 'important');
            const parent = btn.closest('.tracklist-toolbar, .in-page-search, .search-container');
            if (parent && !parent.closest('aside, .q-drawer, .chrome-top')) {
              parent.style.setProperty('display', 'none', 'important');
            }
          }
        }
      });
    };

    purgePills();
    setInterval(purgePills, 300);
  }

  /* --------------------------------------------------------------------------
     FEATURE 5: WINDOWS 10 FLUENT REVEAL HIGHLIGHT
     -------------------------------------------------------------------------- */
  setupRevealHighlight() {
    window.addEventListener('pointermove', (e) => {
      const tile = e.target.closest(
        '.mediaitem-card, .artworkContainer, .artworkLockup, .shelf-artwork, .ri-shelf-artwork, .powerswoosh, .category-brick, .ri-shelf-item, .item-artwork, .brick-item-container'
      );
      if (tile) {
        const rect = tile.getBoundingClientRect();
        tile.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        tile.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);

        // Propagate coordinates to parent card if cursor was over an inner element
        const parentCard = tile.closest('.mediaitem-card, .ri-shelf-item, .powerswoosh');
        if (parentCard && parentCard !== tile) {
          const pRect = parentCard.getBoundingClientRect();
          parentCard.style.setProperty('--mouse-x', `${e.clientX - pRect.left}px`);
          parentCard.style.setProperty('--mouse-y', `${e.clientY - pRect.top}px`);
        }
      }
    }, { passive: true });
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
