import axios from 'axios';
import { Actor, log } from 'apify';

/**
 * BaseRow integration for storing scraped emlak (real estate) listings
 */
export class BaseRowIntegration {
    /**
     * Initialize BaseRow integration
     * @param {Object} options Configuration options
     * @param {string} options.apiToken BaseRow API token
     * @param {string} options.tableId BaseRow table ID
     * @param {string} options.databaseId BaseRow database ID
     */
    constructor(options) {
        const { apiToken, tableId, databaseId } = options;

        if (!apiToken) throw new Error('BaseRow API token is required');
        if (!tableId) throw new Error('BaseRow table ID is required');
        if (!databaseId) throw new Error('BaseRow database ID is required');

        this.apiToken = apiToken;
        this.tableId = tableId;
        this.databaseId = databaseId;
        this.baseUrl = 'https://api.baserow.io/api';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Token ${this.apiToken}`,
                'Content-Type': 'application/json',
            },
        });

        log.info('BaseRow integration initialized', { tableId, databaseId });
    }

    /**
     * Store a single emlak listing in BaseRow
     * @param {Object} listingData Emlak listing data
     * @returns {Promise<Object>} Created row data
     */
    async storeListing(listingData) {
        try {
            const rowData = this._prepareRowData(listingData);

            // Check if listing already exists to avoid duplicates
            const existingRow = await this._findExistingListing(listingData.id);

            if (existingRow) {
                log.info(`Updating existing listing: ${listingData.id}`);
                return await this._updateRow(existingRow.id, rowData);
            } else {
                log.info(`Creating new listing: ${listingData.id}`);
                return await this._createRow(rowData);
            }
        } catch (error) {
            log.error(`Error storing listing in BaseRow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Store multiple emlak listings in BaseRow
     * @param {Array<Object>} listings Array of emlak listing data
     * @returns {Promise<Array<Object>>} Created/updated row data
     */
    async storeListings(listings) {
        log.info(`Storing ${listings.length} listings in BaseRow`);

        const results = [];
        for (const listingData of listings) {
            try {
                const result = await this.storeListing(listingData);
                results.push(result);
            } catch (error) {
                log.error(`Error storing listing ${listingData.id}: ${error.message}`);
            }
        }

        log.info(`Successfully stored ${results.length} out of ${listings.length} listings`);
        return results;
    }

    /**
     * Find an existing listing by ID
     * @param {string} listingId Sahibinden.com listing ID
     * @returns {Promise<Object|null>} Existing row or null if not found
     * @private
     */
    async _findExistingListing(listingId) {
        try {
            const response = await this.client.get(
                `/database/rows/table/${this.tableId}/`,
                {
                    params: {
                        search: listingId,
                        user_field_names: true,
                    },
                }
            );

            const rows = response.data.results;
            return rows.find(row => row.listing_id === listingId) || null;
        } catch (error) {
            log.error(`Error finding existing listing: ${error.message}`);
            return null;
        }
    }

    /**
     * Create a new row in BaseRow
     * @param {Object} rowData Row data
     * @returns {Promise<Object>} Created row data
     * @private
     */
    async _createRow(rowData) {
        const response = await this.client.post(
            `/database/rows/table/${this.tableId}/`,
            rowData,
            {
                params: {
                    user_field_names: true,
                },
            }
        );

        return response.data;
    }

    /**
     * Update an existing row in BaseRow
     * @param {number} rowId BaseRow row ID
     * @param {Object} rowData Row data
     * @returns {Promise<Object>} Updated row data
     * @private
     */
    async _updateRow(rowId, rowData) {
        const response = await this.client.patch(
            `/database/rows/table/${this.tableId}/${rowId}/`,
            rowData,
            {
                params: {
                    user_field_names: true,
                },
            }
        );

        return response.data;
    }

    /**
     * Prepare emlak data for BaseRow
     * @param {Object} data Emlak listing data
     * @returns {Object} Prepared row data
     * @private
     */
    _prepareRowData(data) {
        return {
            listing_id: data.id || '',
            url: data.url || '',
            title: data.title || '',
            price: data.price || 0,
            price_currency: data.price_currency || 'TL',
            location: data.location || '',
            description: data.description || '',
            date: data.date || '',

            // Emlak-specific fields
            rooms: data.rooms || data.info?.['Oda Sayısı'] || '',
            size: data.size || data.info?.['Brüt / Net M2'] || data.info?.['m² (Brüt)'] || '',
            building_age: data.buildingAge || data.info?.['Bina Yaşı'] || '',
            floor: data.floor || data.info?.['Bulunduğu Kat'] || '',
            total_floors: data.totalFloors || data.info?.['Kat Sayısı'] || '',
            heating: data.heating || data.info?.['Isınma'] || '',
            furnished: data.furnished || data.info?.['Eşyalı'] || '',
            usage_status: data.usage || data.info?.['Kullanım Durumu'] || '',
            in_site: data.inSite || data.info?.['Site İçinde'] || '',
            dues: data.dues || data.info?.['Aidat'] || '',
            deed_status: data.deedStatus || data.info?.['Tapu Durumu'] || '',
            credit_eligible: data.creditEligible || data.info?.['Krediye Uygun'] || '',
            seller: data.seller || '',

            // Images as JSON string
            images: JSON.stringify(data.images || []),

            // All info as JSON string (for any fields not mapped above)
            all_info: JSON.stringify(data.info || {}),

            // Metadata
            scraped_at: data.scrapedAt || new Date().toISOString(),
            last_updated: new Date().toISOString(),
        };
    }
}

/**
 * Create BaseRow integration from Actor input
 * @returns {Promise<BaseRowIntegration|null>} BaseRow integration instance or null
 */
export async function createBaseRowIntegration() {
    const input = await Actor.getInput() || {};
    const { baseRowApiToken, baseRowTableId, baseRowDatabaseId } = input;

    if (!baseRowApiToken || !baseRowTableId || !baseRowDatabaseId) {
        log.info('BaseRow integration not configured. Data will only be stored in Apify dataset.');
        return null;
    }

    return new BaseRowIntegration({
        apiToken: baseRowApiToken,
        tableId: baseRowTableId,
        databaseId: baseRowDatabaseId,
    });
}
