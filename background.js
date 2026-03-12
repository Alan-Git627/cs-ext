const STEAM_APP_ID = 730;
const STEAM_CURRENCY_USD = 1;

function parseSteamPrice(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

async function fetchSteamPrice(marketHashName) {
  const endpoint = new URL('https://steamcommunity.com/market/priceoverview/');
  endpoint.searchParams.set('appid', String(STEAM_APP_ID));
  endpoint.searchParams.set('currency', String(STEAM_CURRENCY_USD));
  endpoint.searchParams.set('market_hash_name', marketHashName);

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: 'application/json'
    },
    credentials: 'omit'
  });

  if (!response.ok) {
    throw new Error(`Steam request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new Error('Steam payload did not include a successful result');
  }

  const lowestPrice = parseSteamPrice(payload.lowest_price);
  const medianPrice = parseSteamPrice(payload.median_price);

  return {
    marketHashName,
    lowestPrice,
    medianPrice,
    volume: payload.volume || null,
    raw: payload
  };
}

async function enrichListingsWithSteamPrices(listings) {
  const cache = new Map();

  const enriched = await Promise.all(
    listings.map(async (listing) => {
      const key = listing.marketHashName;
      if (!key) {
        return {
          ...listing,
          steamLowestPrice: null,
          steamMedianPrice: null,
          discountPercent: null,
          steamError: 'Missing market hash name'
        };
      }

      if (!cache.has(key)) {
        cache.set(
          key,
          fetchSteamPrice(key).catch((error) => ({
            marketHashName: key,
            error: error.message
          }))
        );
      }

      const steamData = await cache.get(key);
      if (steamData.error) {
        return {
          ...listing,
          steamLowestPrice: null,
          steamMedianPrice: null,
          discountPercent: null,
          steamError: steamData.error
        };
      }

      const steamReference = steamData.lowestPrice ?? steamData.medianPrice;
      const hasNumbers = Number.isFinite(steamReference) && Number.isFinite(listing.marketPrice);
      const discountPercent = hasNumbers
        ? ((steamReference - listing.marketPrice) / steamReference) * 100
        : null;

      return {
        ...listing,
        steamLowestPrice: steamData.lowestPrice,
        steamMedianPrice: steamData.medianPrice,
        discountPercent: Number.isFinite(discountPercent) ? discountPercent : null,
        steamError: null
      };
    })
  );

  return enriched;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FETCH_STEAM_COMPARISON') {
    enrichListingsWithSteamPrices(message.payload?.listings || [])
      .then((items) => sendResponse({ ok: true, items }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const [tab] = tabs;
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab found.' });
        return;
      }
      sendResponse({ ok: true, tabId: tab.id, url: tab.url });
    });
    return true;
  }

  return false;
});
