const statusEl = document.getElementById('status');
const refreshButton = document.getElementById('refreshButton');
const minimumDiscountInput = document.getElementById('minimumDiscount');
const resultsBody = document.getElementById('resultsBody');

function formatMoney(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatFloat(value) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(6);
}

function formatDiscount(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

async function sendToRuntime(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

async function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, resolve);
  });
}

function renderRows(items) {
  resultsBody.innerHTML = '';

  if (!items.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" class="muted">No items matched your filter.</td>';
    resultsBody.appendChild(row);
    return;
  }

  for (const item of items) {
    const row = document.createElement('tr');
    const discountClass = Number.isFinite(item.discountPercent)
      ? item.discountPercent >= 0
        ? 'discount-positive'
        : 'discount-negative'
      : 'muted';

    row.innerHTML = `
      <td>${item.itemName}</td>
      <td>${formatFloat(item.floatValue)}</td>
      <td>${formatMoney(item.marketPrice)}</td>
      <td>${formatMoney(item.steamLowestPrice ?? item.steamMedianPrice)}</td>
      <td class="${discountClass}">${formatDiscount(item.discountPercent)}</td>
    `;

    resultsBody.appendChild(row);
  }
}

async function refresh() {
  statusEl.textContent = 'Fetching items from current tab...';

  const activeTabResponse = await sendToRuntime({ type: 'GET_ACTIVE_TAB' });
  if (!activeTabResponse?.ok) {
    statusEl.textContent = activeTabResponse?.error || 'Could not detect active tab.';
    return;
  }

  const tabUrl = activeTabResponse.url || '';
  if (!/skinport\.com|cs\.money/.test(tabUrl)) {
    statusEl.textContent = 'Active tab is not Skinport or CS.MONEY.';
    renderRows([]);
    return;
  }

  const scrapeResponse = await sendToTab(activeTabResponse.tabId, { type: 'SCRAPE_MARKET_ITEMS' });
  if (!scrapeResponse?.ok) {
    statusEl.textContent = 'Unable to scrape items from this page.';
    renderRows([]);
    return;
  }

  const listings = scrapeResponse.listings || [];
  if (!listings.length) {
    statusEl.textContent = 'No listings detected on the page. Scroll/load items and try again.';
    renderRows([]);
    return;
  }

  statusEl.textContent = `Found ${listings.length} listing(s). Fetching Steam prices...`;
  const comparisonResponse = await sendToRuntime({
    type: 'FETCH_STEAM_COMPARISON',
    payload: { listings }
  });

  if (!comparisonResponse?.ok) {
    statusEl.textContent = comparisonResponse?.error || 'Failed to fetch Steam pricing.';
    renderRows([]);
    return;
  }

  const minimumDiscount = Number.parseFloat(minimumDiscountInput.value) || 0;
  const filtered = (comparisonResponse.items || [])
    .filter((item) => Number.isFinite(item.discountPercent) && item.discountPercent >= minimumDiscount)
    .sort((a, b) => b.discountPercent - a.discountPercent);

  statusEl.textContent = `Showing ${filtered.length}/${comparisonResponse.items.length} item(s) with discount ≥ ${minimumDiscount.toFixed(2)}%.`;
  renderRows(filtered);
}

refreshButton.addEventListener('click', refresh);
minimumDiscountInput.addEventListener('change', refresh);

document.addEventListener('DOMContentLoaded', refresh);
