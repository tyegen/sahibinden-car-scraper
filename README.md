# Sahibinden Real Estate Scraper 🏠

A powerful Apify Actor that scrapes real estate listings from Sahibinden.com (Turkey's largest classified ads platform). Extracts property details including price, location, size, rooms, building age, and more.

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
| `startUrls` | Array | `satilik-daire/istanbul` | Sahibinden.com category page URLs |
| `maxItems` | Integer | All | Maximum number of listings to scrape |
| `includeDetails` | Boolean | `false` | Scrape detail pages for full info |
| `maxConcurrency` | Integer | `3` | Max concurrent pages (3-5 recommended) |
| `proxyConfiguration` | Object | RESIDENTIAL/TR | Proxy settings |

### Output (Basic - `includeDetails: false`)

```json
{
    "id": "1234567890",
    "url": "https://www.sahibinden.com/ilan/...",
    "title": "3+1 Satılık Daire Kadıköy",
    "price": 4500000,
    "price_currency": "TL",
    "location": "İstanbul / Kadıköy",
    "date": "21 Şubat 2026",
    "image": "https://...",
    "scrapedAt": "2026-02-21T12:00:00.000Z",
    "sourceUrl": "https://www.sahibinden.com/satilik-daire/istanbul"
}
```

### Output (Detailed - `includeDetails: true`)

Additional fields when detail scraping is enabled:

```json
{
    "description": "Kadıköy merkezde...",
    "images": ["https://...", "https://..."],
    "seller": "Emlak Ofisi",
    "rooms": "3+1",
    "size": "140 / 120",
    "buildingAge": "5-10",
    "floor": "3",
    "totalFloors": "8",
    "heating": "Doğalgaz",
    "furnished": "Hayır",
    "usage": "Boş",
    "inSite": "Evet",
    "dues": "500 TL",
    "deedStatus": "Kat Mülkiyeti",
    "creditEligible": "Evet",
    "info": {
        "Oda Sayısı": "3+1",
        "Brüt / Net M2": "140 / 120",
        "...": "..."
    }
}
```

### Supported URL Formats

```
# Category-based
https://www.sahibinden.com/satilik-daire/istanbul
https://www.sahibinden.com/kiralik-daire/aydin
https://www.sahibinden.com/satilik-arsa/izmir
https://www.sahibinden.com/satilik-villa/antalya

# With filters
https://www.sahibinden.com/satilik-daire/istanbul?sorting=date_desc&pagingSize=50
```

### Usage Example (API)

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const input = {
    startUrls: [
        { url: 'https://www.sahibinden.com/satilik-daire/istanbul?sorting=date_desc' }
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
const run = await client.actor('YOUR_USERNAME/sahibinden-real-estate-scraper').call(input);
```

### ⚠️ Important Notes

- **Session Cookies are highly recommended** — Sahibinden.com frequently redirects scraper proxy IPs to the mandatory login page (`/giris`). You must provide your own exported Session Cookies to bypass this wall. **Do not save your cookies when publishing the actor publicly.** Provide them only when running your own tasks.
- **RESIDENTIAL proxy is required** — Sahibinden.com blocks datacenter IPs.
- **Keep `maxConcurrency` at 3-5** — Higher values increase the risk of your session cookies or proxy being banned.
- **Country code `TR`** — Turkish residential proxies work best for latency and stealth.
- **Selectors may change** — Sahibinden.com updates their HTML periodically to break automated extraction.
