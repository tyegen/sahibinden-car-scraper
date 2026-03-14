// src/main.js - Sahibinden.com Emlak Scraper
import { Actor } from 'apify';
import { PuppeteerCrawler, log } from 'crawlee';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
    randomUserAgent,
    randomDelay,
    formatPrice,
    extractCurrency,
    normalizeText,
    extractListingId,
} from './utils.js';
import { createBaseRowIntegration } from './baserow.js';

// Apply the stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// Initialize the Apify Actor
await Actor.init();

// Get input
const input = await Actor.getInput() || {};
const {
    startUrls = [{ url: 'https://www.sahibinden.com/satilik-daire/istanbul?sorting=date_desc' }],
    maxItems = null,
    includeDetails = false,
    maxConcurrency = 3,
    proxyConfiguration = {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        countryCode: 'TR',
    },
    // BaseRow fields (optional)
    baseRowApiToken,
    baseRowTableId,
    baseRowDatabaseId,
    // Session Cookies for login bypass
    sessionCookies = [],
} = input;

// Force RESIDENTIAL proxy with TR country code
// Even if user provides partial proxy config, ensure RESIDENTIAL is used
const finalProxyConfiguration = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'TR',
    ...(proxyConfiguration || {}),
};
// Always ensure RESIDENTIAL is in the groups
if (!finalProxyConfiguration.apifyProxyGroups || finalProxyConfiguration.apifyProxyGroups.length === 0) {
    finalProxyConfiguration.apifyProxyGroups = ['RESIDENTIAL'];
}
if (!finalProxyConfiguration.countryCode) {
    finalProxyConfiguration.countryCode = 'TR';
}

// Create the proxy configuration
const proxyConfig = await Actor.createProxyConfiguration(finalProxyConfiguration);

log.info('Starting Sahibinden Emlak Scraper', {
    startUrls: startUrls.map(u => typeof u === 'string' ? u : u.url),
    maxItems,
    includeDetails,
    maxConcurrency,
    proxyGroups: finalProxyConfiguration.apifyProxyGroups,
    countryCode: finalProxyConfiguration.countryCode,
});

if (proxyConfig) {
    log.info('Using proxy configuration', {
        type: proxyConfig.usesApifyProxy ? 'Apify Proxy' : 'Custom Proxies',
        groups: finalProxyConfiguration.apifyProxyGroups,
        country: finalProxyConfiguration.countryCode,
    });
} else {
    log.warning('No proxy configuration specified. Sahibinden.com requires RESIDENTIAL proxy!');
}

// Initialize BaseRow integration if configured
let baseRowIntegration = null;
try {
    baseRowIntegration = await createBaseRowIntegration();
} catch (error) {
    log.warning('BaseRow integration initialization failed, continuing without it.', { error: error.message });
}

let scrapedItemsCount = 0;

// Store for detail page data (keyed by URL)
const detailDataStore = {};

// Create the Puppeteer crawler
const crawler = new PuppeteerCrawler({
    proxyConfiguration: proxyConfig,
    maxConcurrency,
    maxRequestsPerCrawl: maxItems ? maxItems * 3 : 1000,
    maxRequestRetries: 8,
    navigationTimeoutSecs: 90,
    requestHandlerTimeoutSecs: 180,

    // Session pool: persists cookies (including Cloudflare clearance) across requests
    useSessionPool: true,
    persistCookiesPerSession: true,
    sessionPoolOptions: {
        maxPoolSize: 10,
        sessionOptions: {
            maxUsageCount: 50,
        },
    },

    browserPoolOptions: {
        retireBrowserAfterPageCount: 20,
    },

    launchContext: {
        launcher: puppeteer,
        launchOptions: {
            headless: process.env.HEADLESS !== 'false', // allow debugging with HEADLESS=false
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--start-maximized',
                // Additional stealth flags
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        },
        useChrome: true, // often better for stealth than chromium
    },

    preNavigationHooks: [
        async ({ page, request }, gotoOptions) => {
            // Apply session cookies if provided
            if (sessionCookies && Array.isArray(sessionCookies) && sessionCookies.length > 0) {
                try {
                    // Puppeteer expects cookies without generic attributes sometimes, formatting them
                    const formattedCookies = sessionCookies.map(c => ({
                        name: c.name,
                        value: c.value,
                        domain: c.domain || '.sahibinden.com',
                        path: c.path || '/',
                        secure: c.secure !== false,
                        httpOnly: c.httpOnly === true,
                        sameSite: c.sameSite || 'Lax'
                    }));
                    await page.setCookie(...formattedCookies);
                    log.debug(`Injected ${formattedCookies.length} session cookies.`);
                } catch (e) {
                    log.warning(`Failed to inject session cookies: ${e.message}`);
                }
            }

            const ua = randomUserAgent();
            await page.setUserAgent(ua);
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
            });

            // Keep the viewport consistent with the window size to avoid detection
            const width = 1920;
            const height = 1080;
            await page.setViewport({ width, height });

            // Advanced stealth overrides
            await page.evaluateOnNewDocument(() => {
                // Pass webdriver check
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Pass chrome check
                window.chrome = {
                    runtime: {},
                    loadTimes: function () { },
                    csi: function () { },
                    app: {}
                };

                // Pass permissions check
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = parameters => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => {
                        const plugins = [
                            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                            { name: 'Chrome PDF Viewer', filename: 'mhjimihiapuabedfglidnhagcfenogec', description: '' },
                            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                        ];

                        // Add mock methods expected from the PluginArray
                        plugins.item = (i) => plugins[i];
                        plugins.namedItem = (name) => plugins.find(p => p.name === name);
                        plugins.refresh = () => { };

                        // Fake the iterator
                        plugins[Symbol.iterator] = function* () {
                            yield* Object.values(plugins);
                        };

                        // Inherit from PluginArray
                        Object.setPrototypeOf(plugins, PluginArray.prototype);

                        return plugins;
                    }
                });

                // Mock languages
                Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });

                // Add dummy WebGL functions to thwart fingerprinting
                const getParameter = WebGLRenderingContext.getParameter;
                WebGLRenderingContext.prototype.getParameter = function (parameter) {
                    // UNMASKED_VENDOR_WEBGL
                    if (parameter === 37445) {
                        return 'Intel Inc.';
                    }
                    // UNMASKED_RENDERER_WEBGL
                    if (parameter === 37446) {
                        return 'Intel Iris OpenGL Engine';
                    }
                    return getParameter(parameter);
                };
            });

            if (gotoOptions) {
                gotoOptions.waitUntil = 'networkidle2';
                gotoOptions.timeout = 90000;
            }
        },
    ],

    postNavigationHooks: [
        async ({ page, response, request, session, log }) => {
            const statusCode = response?.status();
            log.info(`Response status: ${statusCode} for ${request.url}`);

            // If we got 403, wait for Cloudflare challenge to resolve
            if (statusCode === 403 || statusCode === 503 || statusCode === 429) {
                log.warning(`Got ${statusCode}, waiting for Cloudflare challenge to resolve...`);

                // Wait for Cloudflare JS to execute and redirect
                await randomDelay(5000, 10000);

                // Simulate human movement
                try {
                    await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 500);
                    await page.mouse.move(200 + Math.random() * 500, 200 + Math.random() * 500);
                } catch (e) { }

                // Check if we're on a Cloudflare challenge page
                const content = await page.content();
                if (
                    content.includes('Just a moment') ||
                    content.includes('Checking your browser') ||
                    content.includes('cf-browser-verification') ||
                    content.includes('challenge-platform') ||
                    content.includes('Güvenlik doğrulaması gerçekleştirme') ||
                    content.includes('Uyumsuz tarayıcı eklentisi')
                ) {
                    log.info('Cloudflare challenge page detected, waiting for resolution...');

                    // Wait for navigation (Cloudflare auto-redirects after solving)
                    try {
                        await page.waitForNavigation({
                            waitUntil: 'networkidle2',
                            timeout: 45000, // increased timeout for solving
                        });
                        log.info('Cloudflare challenge resolved!');
                    } catch (e) {
                        log.warning('Cloudflare challenge did not resolve in time. Retrying...');
                        if (session) session.markBad();
                        throw new Error('Cloudflare challenge timeout');
                    }
                } else {
                    // True 403 block, mark session as bad and retry
                    log.warning('Received 403 without recognized Cloudflare challenge. Marking session as bad.');
                    if (session) session.markBad();
                    throw new Error(`Blocked with status ${statusCode}`);
                }
            }

            // Validate we're on the right page
            const currentUrl = page.url();
            if (currentUrl.includes('/giris') || currentUrl.includes('secure.sahibinden.com')) {
                log.error('Redirected to login page. Your session cookies are missing or expired.');
                if (session) session.markBad();

                // We must abort the whole crawl if login is required but cookies are invalid,
                // otherwise it'll just burn through proxies and retries uselessly.
                throw new Error('Mandatory login required. Please update the sessionCookies input.');
            }

            if (statusCode && statusCode >= 200 && statusCode < 300) {
                if (session) session.markGood();
            }
        },
    ],

    requestHandler: async ({ page, request, enqueueLinks, session }) => {
        const label = request.userData?.label || 'CATEGORY';
        log.info(`Processing page [${label}]: ${request.url}`);

        // Random delay to simulate human behavior
        await randomDelay(2000, 5000);

        try {
            // Check for Sahibinden's internal /cs/tloading redirect challenge
            let currentUrl = page.url();
            let pageTitle = await page.title().catch(() => '');

            if (currentUrl.includes('/cs/tloading') || pageTitle.includes('Yükleniyor')) {
                log.warning('Detected /cs/tloading intermediate page. Waiting for automatic redirect...');
                // Wait for JS execution and redirect
                await randomDelay(5000, 10000);

                // Wait for the actual navigation back to the content page
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });

                currentUrl = page.url();
                if (currentUrl.includes('/cs/tloading')) {
                    log.error('Still stuck on /cs/tloading page after timeout.');
                    if (session) session.markBad();
                    throw new Error('Stuck on /cs/tloading page');
                }
                log.info(`Successfully passed /cs/tloading. Now on: ${currentUrl}`);
            }

            // Additional Cloudflare check on page content
            const pageContent = await page.content();
            if (
                pageContent.includes('Checking your browser') ||
                pageContent.includes('cf-browser-verification') ||
                pageContent.includes('Just a moment')
            ) {
                log.warning('Cloudflare challenge still present in page, waiting...');
                await randomDelay(8000, 15000);
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });

                // Recheck
                const newContent = await page.content();
                if (newContent.includes('Just a moment') || newContent.includes('Checking your browser')) {
                    if (session) session.markBad();
                    throw new Error('Cloudflare challenge not resolved');
                }
            }

            await page.waitForSelector('body', { timeout: 45000 });

            if (label === 'DETAIL') {
                await handleDetailPage(page, request);
            } else {
                await handleCategoryPage(page, request, enqueueLinks);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Error processing ${request.url}: ${errorMessage}`, {
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    },

    failedRequestHandler: async ({ request }) => {
        log.error(`Request failed after retries: ${request.url}`, {
            errors: request.errorMessages,
        });
    },
});

// CRITICAL: Override Crawlee's internal blocked request check
// Crawlee hardcodes 403 as "blocked" and throws BEFORE requestHandler runs,
// even when our postNavigationHook successfully resolves the Cloudflare challenge.
// We handle 403/503 ourselves in postNavigationHooks.
const originalThrowOnBlocked = crawler._throwOnBlockedRequest?.bind(crawler);
if (originalThrowOnBlocked) {
    crawler._throwOnBlockedRequest = function (session, statusCode) {
        if (statusCode === 403 || statusCode === 503) {
            log.debug(`Suppressing Crawlee's built-in ${statusCode} block check (handled by postNavigationHook)`);
            return;
        }
        return originalThrowOnBlocked(session, statusCode);
    };
    log.info('Overridden Crawlee blocked request check for Cloudflare compatibility');
}

// =============================================
// CATEGORY PAGE HANDLER
// =============================================
async function handleCategoryPage(page, request, enqueueLinks) {
    log.info(`Handling category page: ${request.url}`);

    const listingRowSelector = 'tbody.searchResultsRowClass > tr.searchResultsItem';
    const titleLinkSelector = 'td.searchResultsTitleValue a.classifiedTitle';
    const priceSelector = 'td.searchResultsPriceValue span';
    const dateSelector = 'td.searchResultsDateValue';
    const locationSelector = 'td.searchResultsLocationValue';
    const nextPageSelector = 'a.prevNextBut[title="Sonraki"]:not(.passive)';

    try {
        // Try the main selector first
        let listingElements = [];
        try {
            await page.waitForSelector(listingRowSelector, { timeout: 15000 });
            listingElements = await page.$$(listingRowSelector);
        } catch (e) {
            // Check if we got redirected to tloading during the wait
            let currentUrl = page.url();
            let pageTitle = await page.title().catch(() => '');

            if (currentUrl.includes('/cs/tloading') || pageTitle.includes('Yükleniyor')) {
                log.warning('Detected /cs/tloading redirect during selector wait. Waiting for resolution...');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });

                log.info('Navigation complete. Retrying primary selector... Current URL: ' + page.url());
                await page.waitForSelector(listingRowSelector, { timeout: 15000 }).catch(() => { });
                listingElements = await page.$$(listingRowSelector);
            }

            if (listingElements.length === 0) {
                log.warning(`Primary selector failed: ${listingRowSelector}`);

                // DEBUG: Capture page state for analysis
                const pageTitleDebug = await page.title().catch(() => 'unknown');
                const currentUrlDebug = page.url();
                const bodyHTML = await page.$eval('body', el => el.innerHTML.substring(0, 3000)).catch(() => 'Could not get HTML');

                log.info('DEBUG Page state:', { title: pageTitleDebug, url: currentUrlDebug });
                log.info('DEBUG HTML preview (first 2000 chars):', { html: bodyHTML.substring(0, 2000) });

                // Save screenshot to key-value store for debugging
                try {
                    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
                    await Actor.setValue('DEBUG-screenshot', screenshot, { contentType: 'image/png' });
                    log.info('DEBUG: Screenshot saved to key-value store as "DEBUG-screenshot"');
                } catch (screenshotErr) {
                    log.warning('Could not save debug screenshot');
                }

                // Try alternative selectors
                const alternativeSelectors = [
                    'table.searchResultsTable tr.searchResultsItem',
                    '.searchResultsRowClass .searchResultsItem',
                    'tr.searchResultsItem',
                    '.classified-list-item',
                    '[data-id]',
                    '.searchResults .result-item',
                    'table tr[data-id]',
                ];

                for (const altSelector of alternativeSelectors) {
                    const altElements = await page.$$(altSelector);
                    if (altElements.length > 0) {
                        log.info(`Found ${altElements.length} elements with alternative selector: ${altSelector}`);
                        listingElements = altElements;
                        break;
                    }
                }

                if (listingElements.length === 0) {
                    // Log all table elements on the page
                    const tableCount = await page.$$eval('table', tables => tables.length).catch(() => 0);
                    const trCount = await page.$$eval('tr', rows => rows.length).catch(() => 0);
                    const tbodyCount = await page.$$eval('tbody', bodies => bodies.length).catch(() => 0);
                    log.info('DEBUG: Page structure', { tables: tableCount, rows: trCount, tbodies: tbodyCount });

                    // Log all class names containing "search" or "result"
                    const searchClasses = await page.evaluate(() => {
                        const allElements = document.querySelectorAll('*');
                        const classes = new Set();
                        allElements.forEach(el => {
                            if (el.className && typeof el.className === 'string') {
                                el.className.split(' ').forEach(cls => {
                                    if (cls.toLowerCase().includes('search') || cls.toLowerCase().includes('result') || cls.toLowerCase().includes('listing') || cls.toLowerCase().includes('classified')) {
                                        classes.add(cls);
                                    }
                                });
                            }
                        });
                        return Array.from(classes);
                    }).catch(() => []);
                    log.info('DEBUG: Relevant CSS classes found:', { classes: searchClasses });

                    throw new Error('No listing elements found with any selector');
                }
            } // end if listingElements.length === 0
        } // end catch (e)

        log.info(`Found ${listingElements.length} listings on page.`);

        const results = [];

        for (const element of listingElements) {
            // Check maxItems limit
            if (maxItems !== null && scrapedItemsCount >= maxItems) {
                log.info(`Maximum items limit (${maxItems}) reached. Stopping scrape.`);

                // Push any currently collected results before aborting
                if (results.length > 0) {
                    await Actor.pushData(results);
                    if (baseRowIntegration) {
                        try {
                            await baseRowIntegration.storeListings(results);
                        } catch (error) {
                            log.warning('Failed to store data in BaseRow', { error: error.message });
                        }
                    }
                }

                await crawler.autoscaledPool?.abort();
                return;
            }

            try {
                // Extract title and URL
                const titleElement = await element.$(titleLinkSelector);
                const title = await titleElement?.evaluate(el => el.textContent?.trim()).catch(() => null);
                const detailUrl = await titleElement?.evaluate(el => el.href).catch(() => null);

                if (!title || !detailUrl) {
                    log.debug('Skipping row due to missing title or detailUrl.');
                    continue;
                }

                // Extract price
                const priceText = await element.$eval(priceSelector, el => el.textContent?.trim()).catch(() => null);

                // Extract location
                const location = await element.$eval(locationSelector, el => {
                    return el.innerText?.trim().replace(/\n/g, ' / ');
                }).catch(() => null);

                // Extract date
                const date = await element.$eval(dateSelector, el => {
                    return el.innerText?.trim().replace(/\n/g, ' ');
                }).catch(() => null);

                // Extract thumbnail image
                const image = await element.$eval('img', el => el.src || el.dataset?.src || null).catch(() => null);

                // Try to extract column-specific data (m², rooms etc.) from the table cells
                // Sahibinden emlak listing columns vary by category, so we extract all td cells
                const cellTexts = await element.$$eval('td', cells =>
                    cells.map(cell => cell.textContent?.trim() || '')
                ).catch(() => []);

                // Extract listing ID from URL
                const id = extractListingId(detailUrl);

                const listingData = {
                    id: id,
                    url: detailUrl,
                    title: normalizeText(title),
                    make: cellTexts[1] ? normalizeText(cellTexts[1]) : null,
                    series: cellTexts[2] ? normalizeText(cellTexts[2]) : null,
                    model: cellTexts[3] ? normalizeText(cellTexts[3]) : null,
                    year: cellTexts[5] ? normalizeText(cellTexts[5]) : null,
                    km: cellTexts[6] ? normalizeText(cellTexts[6]) : null,
                    color: cellTexts[7] ? normalizeText(cellTexts[7]) : null,
                    price: formatPrice(priceText),
                    price_currency: extractCurrency(priceText),
                    price_raw: priceText,
                    location: normalizeText(location),
                    date: normalizeText(date),
                    image: image,
                    scrapedAt: new Date().toISOString(),
                    sourceUrl: request.url,
                };

                // If includeDetails is enabled, enqueue the detail page
                if (includeDetails && detailUrl) {
                    await enqueueLinks({
                        urls: [detailUrl],
                        userData: {
                            label: 'DETAIL',
                            listingData: listingData,
                        },
                    });
                    // Don't push to dataset yet — will push from detail handler
                } else {
                    results.push(listingData);
                    scrapedItemsCount++;
                }

            } catch (extractError) {
                const errorMsg = extractError instanceof Error ? extractError.message : String(extractError);
                log.warning(`Could not process one item on ${request.url}`, { error: errorMsg });
            }
        }

        // Push results from this page (only if not including details)
        if (results.length > 0) {
            await Actor.pushData(results);
            log.info(`Pushed ${results.length} listings from page. Total scraped: ${scrapedItemsCount}`);

            // Store in BaseRow if configured
            if (baseRowIntegration) {
                try {
                    await baseRowIntegration.storeListings(results);
                } catch (error) {
                    log.warning('Failed to store data in BaseRow', { error: error.message });
                }
            }
        } else if (!includeDetails) {
            log.info(`No listings extracted from page ${request.url}.`);
        }

        // Enqueue next page
        if (maxItems !== null && scrapedItemsCount >= maxItems) {
            log.info(`Maximum items limit (${maxItems}) reached. Not enqueueing next page.`);
            await crawler.autoscaledPool?.abort();
            return;
        }

        const nextPageUrl = await page.$eval(nextPageSelector, anchor => anchor.href).catch(() => null);
        if (nextPageUrl) {
            log.info(`Enqueueing next category page: ${nextPageUrl}`);
            const absoluteNextPageUrl = new URL(nextPageUrl, request.loadedUrl || request.url).toString();
            await enqueueLinks({
                urls: [absoluteNextPageUrl],
                userData: { label: 'CATEGORY' },
            });

            // Small delay before next page
            await randomDelay(1000, 3000);
        } else {
            log.info(`No next page button found on ${request.url}`);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.warning(`Could not handle category page ${request.url}: ${errorMessage}`);
    }
}

// =============================================
// DETAIL PAGE HANDLER
// =============================================
async function handleDetailPage(page, request) {
    log.info(`Handling detail page: ${request.url}`);

    // Get the base listing data passed from the category page
    const listingData = request.userData?.listingData || {};

    try {
        // Wait for the page to load
        await page.waitForSelector('body', { timeout: 30000 });
        await randomDelay(1000, 3000);

        // Extract description
        const description = await page.$eval('#classifiedDescription', el => {
            return el.textContent?.trim() || '';
        }).catch(() => '');

        // Extract all info fields from the classified info list
        const info = {};
        try {
            const infoItems = await page.$$('.classifiedInfoList li');
            for (const item of infoItems) {
                const label = await item.$eval('strong', el => el.textContent?.trim()).catch(() => null);
                const value = await item.$eval('span', el => el.textContent?.trim()).catch(() => null);
                if (label && value) {
                    info[normalizeText(label)] = normalizeText(value);
                }
            }
        } catch (e) {
            log.debug('Could not extract info list', { error: e.message });
        }

        // Extract images
        const images = await page.$$eval(
            '.classifiedDetailMainPhoto img, .swiper-slide img, #classifiedDetailPhotos img',
            imgs => imgs.map(img => img.src || img.dataset?.src).filter(Boolean)
        ).catch(() => []);

        // Deduplicate images
        const uniqueImages = [...new Set(images)];

        // Extract seller info
        const seller = await page.$eval(
            '.classifiedUserContent h5, .classifiedOtherBoxes .username-info-area',
            el => el.textContent?.trim()
        ).catch(() => null);

        // Extract listing ID from the page if not already present
        const pageId = await page.$eval(
            '.classifiedId',
            el => el.textContent?.replace(/[^0-9]/g, '')
        ).catch(() => null);

        // Build the complete listing data
        const completeData = {
            ...listingData,
            id: listingData.id || pageId || extractListingId(request.url),
            description: normalizeText(description),
            images: uniqueImages,
            seller: seller ? normalizeText(seller) : null,
            info: info,
            // Extract commonly needed fields from info for convenience
            make: info['Marka'] || listingData.make || null,
            series: info['Seri'] || listingData.series || null,
            model: info['Model'] || listingData.model || null,
            year: info['Yıl'] || listingData.year || null,
            fuel: info['Yakıt'] || null,
            gear: info['Vites'] || null,
            km: info['KM'] || listingData.km || null,
            bodyType: info['Kasa Tipi'] || null,
            enginePower: info['Motor Gücü'] || null,
            engineCapacity: info['Motor Hacmi'] || null,
            traction: info['Çekiş'] || null,
            color: info['Renk'] || listingData.color || null,
            warranty: info['Garanti'] || null,
            damageRecord: info['Ağır Hasar Kayıtlı'] || info['Hasar Durumu'] || null,
            plate: info['Plaka / Uyruk'] || null,
            fromWho: info['Kimden'] || null,
        };

        // Push to dataset
        await Actor.pushData(completeData);
        scrapedItemsCount++;
        log.info(`Pushed detail data for listing ${completeData.id}. Total scraped: ${scrapedItemsCount}`);

        // Store in BaseRow if configured
        if (baseRowIntegration) {
            try {
                await baseRowIntegration.storeListing(completeData);
            } catch (error) {
                log.warning('Failed to store detail data in BaseRow', { error: error.message });
            }
        }

        // Check maxItems
        if (maxItems !== null && scrapedItemsCount >= maxItems) {
            log.info(`Maximum items limit (${maxItems}) reached.`);
            await crawler.autoscaledPool?.abort();
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.warning(`Could not handle detail page ${request.url}: ${errorMessage}`);

        // Still try to push the basic listing data
        if (listingData.title) {
            await Actor.pushData(listingData);
            scrapedItemsCount++;
        }
    }
}

// =============================================
// START THE CRAWLER
// =============================================
const startRequests = (Array.isArray(startUrls) ? startUrls : [startUrls]).map(item => {
    let urlString;
    if (typeof item === 'string') {
        urlString = item;
    } else if (item && typeof item.url === 'string') {
        urlString = item.url;
    } else {
        log.warning('Skipping invalid start URL item:', { item });
        return null;
    }

    if (!urlString || !urlString.startsWith('http')) {
        log.warning('Skipping item with invalid URL string:', { urlString });
        return null;
    }

    return { url: urlString, userData: { label: 'CATEGORY' } };
}).filter(req => req !== null);

if (startRequests.length > 0) {
    await crawler.addRequests(startRequests);
    log.info(`Added ${startRequests.length} initial requests to the queue.`);
} else {
    log.warning('No valid start URLs found in the input. Exiting.');
    await Actor.exit(1, 'No valid start URLs provided.');
}

log.info('Starting the crawler...');
await crawler.run();
log.info(`Crawler finished. Total items scraped: ${scrapedItemsCount}`);

await Actor.exit();
