const MARKET_KEYWORDS = ['skinport', 'cs.money'];

const state = {
  latestListings: [],
  observer: null
};

function normalizeWhitespace(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parsePrice(priceText) {
  if (!priceText) return null;
  const cleaned = priceText.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatValue(text) {
  if (!text) return null;
  const match = text.match(/float\s*[:=]?\s*(0\.\d+)/i) || text.match(/\b(0\.\d{1,10})\b/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function toMarketHashName(name) {
  return normalizeWhitespace(name).replace(/\s+/g, ' ');
}

function getHostname() {
  return window.location.hostname;
}

function buildListingFromElement(element) {
  const nameCandidate =
    element.getAttribute('data-market-hash-name') ||
    element.getAttribute('data-item-name') ||
    element.querySelector('[data-testid*="name"], [class*="name" i], [class*="title" i]')?.textContent ||
    element.querySelector('img')?.getAttribute('alt') ||
    '';

  const priceNode =
    element.querySelector('[data-testid*="price"], [class*="price" i]') ||
    Array.from(element.querySelectorAll('*')).find((node) => /[$€£]\s*\d/.test(node.textContent || ''));

  const rawPriceText = normalizeWhitespace(priceNode?.textContent || '');
  const floatNode =
    element.querySelector('[data-testid*="float"], [class*="float" i]') ||
    Array.from(element.querySelectorAll('*')).find((node) => /float/i.test(node.textContent || ''));

  const combinedFloatText = normalizeWhitespace(floatNode?.textContent || element.textContent || '');

  const name = normalizeWhitespace(nameCandidate);
  const marketPrice = parsePrice(rawPriceText);
  const floatValue = parseFloatValue(combinedFloatText);

  if (!name || !Number.isFinite(marketPrice)) return null;

  return {
    id: `${name}-${marketPrice}-${floatValue ?? 'nofloat'}`,
    source: getHostname(),
    itemName: name,
    marketHashName: toMarketHashName(name),
    marketPrice,
    marketPriceText: rawPriceText,
    floatValue,
    capturedAt: Date.now()
  };
}

function selectMarketCards() {
  const host = getHostname();

  if (host.includes('skinport')) {
    return Array.from(
      document.querySelectorAll(
        '[data-testid*="market-item"], [data-testid*="item-card"], [class*="item" i][class*="card" i], [class*="market-item" i]'
      )
    );
  }

  if (host.includes('cs.money')) {
    return Array.from(
      document.querySelectorAll(
        '[data-testid*="inventory-item"], [data-testid*="market-item"], [class*="item" i][class*="card" i], [class*="market-item" i]'
      )
    );
  }

  return [];
}

function dedupeListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

function scrapeListings() {
  if (!MARKET_KEYWORDS.some((key) => getHostname().includes(key))) {
    state.latestListings = [];
    return state.latestListings;
  }

  const cards = selectMarketCards();
  const parsed = cards
    .map((card) => buildListingFromElement(card))
    .filter(Boolean);

  state.latestListings = dedupeListings(parsed);
  return state.latestListings;
}

function installObserver() {
  if (state.observer) return;
  state.observer = new MutationObserver(() => {
    scrapeListings();
  });

  state.observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

scrapeListings();
installObserver();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SCRAPE_MARKET_ITEMS') {
    const listings = scrapeListings();
    sendResponse({ ok: true, listings, sourceUrl: window.location.href });
    return true;
  }

  return false;
});
