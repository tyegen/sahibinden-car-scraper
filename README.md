# Sahibinden Car Scraper 🚗

The ultimate Sahibinden Car Scraper to extract otomobil listings bypassing Cloudflare (tloading) challenges and mandatory login walls. Retrieves Make, Series, Model, Year, KM, Color, Price, Location & Date accurately. Requires TR Residential Proxies and verified Session Cookies to operate.

## Features

- ✅ **Cloudflare Bypass** — Puppeteer + Stealth plugin
- ✅ **Mandatory Login Bypass** — Supports injecting personal Session Cookies to evade IP login walls
- ✅ **Residential Proxy** — Required for Sahibinden.com (TR country code)
- ✅ **Detail Pages** — Optional: scrape full property details, photos, and seller info
- ✅ **Pagination** — Automatically navigates through all result pages
- ✅ **BaseRow Integration** — Optional: store data directly in BaseRow
- ✅ **Human-like Behavior** — Random delays, user agents, and viewport sizes

### Input

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startUrls` | Array | `vasita/otomobil` | Sahibinden.com category page URLs |
| `maxItems` | Integer | All | Maximum number of listings to scrape |
| `includeDetails` | Boolean | `false` | Scrape detail pages for full info |
| `maxConcurrency` | Integer | `3` | Max concurrent pages (3-5 recommended) |
| `proxyConfiguration` | Object | RESIDENTIAL/TR | Proxy settings |

### Output (Basic - `includeDetails: false`)

```json
{
    "id": "1234567890",
    "url": "https://www.sahibinden.com/ilan/...",
    "title": "2018 Ford Focus",
    "make": "Ford",
    "series": "Focus",
    "model": "1.5 TDCi Titanium",
    "year": "2018",
    "km": "50.000",
    "color": "Beyaz",
    "price": 1200000,
    "price_currency": "TL",
    "location": "İstanbul / Kadıköy",
    "date": "21 Şubat 2026",
    "image": "https://...",
    "scrapedAt": "2026-02-21T12:00:00.000Z",
    "sourceUrl": "https://www.sahibinden.com/vasita/otomobil"
}
```

### Output (Detailed - `includeDetails: true`)

Additional fields when detail scraping is enabled:

```json
{
    "description": "Boya, değişen, tramer yoktur...",
    "images": ["https://...", "https://..."],
    "seller": "Galeriden",
    "engineCapacity": "1401 - 1600 cm3",
    "enginePower": "101 - 125 HP",
    "fuel": "Dizel",
    "gear": "Otomatik",
    "damageRecord": "Yok",
    "warranty": "Evet",
    "info": {
        "Motor Hacmi": "1401 - 1600 cm3",
        "Motor Gücü": "101 - 125 HP",
        "...": "..."
    }
}
```

### Supported URL Formats

```
# Category-based
https://www.sahibinden.com/vasita/otomobil/ford
https://www.sahibinden.com/vasita/otomobil/audi
https://www.sahibinden.com/vasita/arazi-suv-pickup

# With filters
https://www.sahibinden.com/vasita/otomobil/ford?sorting=date_desc&pagingSize=50
```

### Usage Example (API)

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const input = {
    startUrls: [
        { url: 'https://www.sahibinden.com/vasita/otomobil/ford?sorting=date_desc' }
    ],
    maxItems: 100,
    includeDetails: false,
    maxConcurrency: 3,
    proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        countryCode: 'TR'
    },
    sessionCookies: [
        // Paste your exported EditThisCookie JSON here
    ]
};

// Run the actor and wait for it to finish
const run = await client.actor('YOUR_USERNAME/sahibinden-car-scraper').call(input);
```

### ⚠️ Important Notes

- **Session Cookies are highly recommended** — Sahibinden.com frequently redirects scraper proxy IPs to the mandatory login page (`/giris`). You must provide your own exported Session Cookies to bypass this wall. **Do not save your cookies when publishing the actor publicly.** Provide them only when running your own tasks.
- **RESIDENTIAL proxy is required** — Sahibinden.com blocks datacenter IPs.
- **Keep `maxConcurrency` at 3-5** — Higher values increase the risk of your session cookies or proxy being banned.
- **Country code `TR`** — Turkish residential proxies work best for latency and stealth.
- **Selectors may change** — Sahibinden.com updates their HTML periodically to break automated extraction.
