import { randomBytes } from 'crypto';

/**
 * Generates a random user agent string for desktop browsers
 * @returns {string} A random user agent string
 */
export function randomUserAgent() {
    const browsers = [
        // Chrome on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

        // Chrome on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

        // Firefox on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',

        // Firefox on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:119.0) Gecko/20100101 Firefox/119.0',

        // Safari on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',

        // Edge on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    ];

    return browsers[Math.floor(Math.random() * browsers.length)];
}

/**
 * Generates a random session ID
 * @returns {string} A random session ID
 */
export function generateSessionId() {
    return `session_${randomBytes(8).toString('hex')}`;
}

/**
 * Adds delay between actions to simulate human behavior
 * @param {number} min Minimum delay in milliseconds
 * @param {number} max Maximum delay in milliseconds
 * @returns {Promise<void>} A promise that resolves after the delay
 */
export function randomDelay(min = 1000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Formats price string to numeric value
 * @param {string} priceStr Price string (e.g., "150.000 TL")
 * @returns {number|null} Numeric price value or null if invalid
 */
export function formatPrice(priceStr) {
    if (!priceStr) return null;

    // Remove all non-numeric characters except decimal point
    const numericStr = priceStr.replace(/[^0-9,.]/g, '')
        .replace(/\./g, '')    // Remove thousands separator (.)
        .replace(/,/g, '.');   // Replace comma with decimal point

    const price = parseFloat(numericStr);
    return isNaN(price) ? null : price;
}

/**
 * Extracts currency from price string
 * @param {string} priceStr Price string (e.g., "150.000 TL")
 * @returns {string} Currency code
 */
export function extractCurrency(priceStr) {
    if (!priceStr) return 'TL';
    if (priceStr.includes('EUR') || priceStr.includes('€')) return 'EUR';
    if (priceStr.includes('USD') || priceStr.includes('$')) return 'USD';
    if (priceStr.includes('GBP') || priceStr.includes('£')) return 'GBP';
    return 'TL';
}

/**
 * Extracts boolean value from Yes/No string in Turkish
 * @param {string} value String value (e.g., "Evet", "Hayır")
 * @returns {boolean|null} Boolean value or null if invalid
 */
export function parseYesNo(value) {
    if (!value) return null;

    const normalized = value.toLowerCase().trim();
    if (normalized === 'evet' || normalized === 'var') return true;
    if (normalized === 'hayır' || normalized === 'yok') return false;

    return null;
}

/**
 * Normalizes text by removing extra whitespace
 * @param {string} text Input text
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts listing ID from a Sahibinden.com URL
 * @param {string} url Listing URL
 * @returns {string|null} Listing ID or null
 */
export function extractListingId(url) {
    if (!url) return null;
    // Sahibinden URLs end with the listing ID, e.g. /ilan/satilik-daire-xxx-1234567890/detay
    const match = url.match(/\/(\d{8,12})/);
    return match ? match[1] : null;
}
