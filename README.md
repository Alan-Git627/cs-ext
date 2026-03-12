# CS Market Discount Finder (Opera Extension)

Compares listings on **Skinport** and **CS.MONEY** against Steam Market instant-buy references and shows discount percentages.

## Features

- Scrapes currently visible items from Skinport / CS.MONEY.
- Reads listing price and detected float value (if present in page DOM text).
- Requests Steam Community Market price overview for each item (`appid=730`).
- Calculates discount:

  `discount % = ((steam price - market price) / steam price) * 100`

- Lets you filter by minimum discount and sorts results by highest discount.

## Install in Opera

1. Open `opera://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open Skinport or CS.MONEY market page and click the extension icon.

## Notes

- Steam does not expose a float-specific instant-buy endpoint. The extension compares by item market hash name and still displays float from the source marketplace when available.
- If a site changes their HTML structure, selector tuning in `contentScript.js` may be needed.
