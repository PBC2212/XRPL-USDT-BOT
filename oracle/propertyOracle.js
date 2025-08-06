/**
 * oracle/propertyOracle.js - Property Valuation Oracle System
 * 
 * This module fetches real estate valuations from multiple APIs
 * and provides weighted average pricing for tokenized properties.
 */

const axios = require('axios');
const xrpl = require('xrpl');

class PropertyOracle {
    constructor(config = {}) {
        this.propertyId = config.propertyId || process.env.PROPERTY_ID;
        this.propertyAddress = config.propertyAddress || process.env.PROPERTY_ADDRESS;
        this.propertyZip = config.propertyZip || process.env.PROPERTY_ZIP;
        
        this.apiKeys = {
            zillow: config.zillowApiKey || process.env.ZILLOW_API_KEY,
            corelogic: config.corelogicApiKey || process.env.CORELOGIC_API_KEY,
            rentspree: config.rentspreeApiKey || process.env.RENTSPREE_API_KEY,
            realtyMole: config.realtyMoleApiKey || process.env.REALTY_MOLE_API_KEY
        };
        
        this.xrplNetwork = config.xrplNetwork || process.env.XRPL_NETWORK;
        this.oracleSeed = config.oracleSeed || process.env.ORACLE_SEED;
        this.minConfidence = parseFloat(config.minConfidence || process.env.MIN_CONFIDENCE_THRESHOLD || '0.70');
        
        this.client = null;
        this.wallet = null;
        this.lastUpdate = null;
        this.cachedValuation = null;
    }

    async initialize() {
        try {
            console.log('🔮 Initializing Property Oracle...');
            
            // Initialize XRPL connection
            this.client = new xrpl.Client(this.xrplNetwork);
            await this.client.connect();
            
            // Load oracle wallet (optional - for on-chain updates)
            if (this.oracleSeed) {
                this.wallet = xrpl.Wallet.fromSeed(this.oracleSeed);
                console.log(`   Oracle Address: ${this.wallet.address}`);
            }
            
            console.log('✅ Property Oracle initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Oracle initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Get comprehensive property valuation from multiple sources
     */
    async getPropertyValuation() {
        try {
            console.log('🔍 Fetching property valuations from multiple sources...');
            
            const valuationPromises = [
                this.getRealtyMoleValuation(),
                this.getZillowValuation(),
                this.getCoreLogicValuation(),
                this.getRentspreeValuation()
            ];

            // Execute all API calls concurrently with error handling
            const results = await Promise.allSettled(valuationPromises);
            
            const validResults = results
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);

            if (validResults.length === 0) {
                console.log('⚠️ No API data available, using mock data for testing');
                validResults.push(this.getMockZillowData());
                validResults.push(this.getMockCoreLogicData());
            }

            console.log(`📊 Received ${validResults.length} valid valuations`);
            
            // Calculate weighted average and confidence
            const valuation = this.calculateWeightedValuation(validResults);
            
            // Cache the result
            this.cachedValuation = valuation;
            this.lastUpdate = new Date();
            
            return valuation;
            
        } catch (error) {
            console.error('💥 Property valuation failed:', error.message);
            
            // Return cached valuation if available
            if (this.cachedValuation) {
                console.log('📋 Returning cached valuation due to API failure');
                return {
                    ...this.cachedValuation,
                    isFromCache: true,
                    cacheAge: Date.now() - this.lastUpdate.getTime()
                };
            }
            
            // Fallback to mock data
            return this.calculateWeightedValuation([
                this.getMockZillowData(),
                this.getMockCoreLogicData()
            ]);
        }
    }

    /**
     * Realty Mole API - Free tier available, good for testing
     */
    async getRealtyMoleValuation() {
        if (!this.apiKeys.realtyMole) {
            console.log('⚠️ Realty Mole API key not configured');
            return null;
        }

        try {
            // Use address-based lookup (works with free tier)
            const response = await axios.get('https://api.realtymole.com/api/v1/avm', {
                params: {
                    address: this.propertyAddress,
                    apiKey: this.apiKeys.realtyMole
                },
                timeout: 10000
            });

            if (response.data && response.data.avm) {
                const avm = response.data.avm;
                return {
                    source: 'RealtyMole',
                    value: avm.value,
                    confidence: avm.confidence || 0.75,
                    lastUpdated: new Date().toISOString(),
                    weight: 0.3,
                    details: {
                        high: avm.high,
                        low: avm.low,
                        accuracy: avm.accuracy
                    }
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Realty Mole API error:', error.message);
            return null;
        }
    }

    /**
     * Zillow API (requires premium access for current data)
     */
    async getZillowValuation() {
        if (!this.apiKeys.zillow) {
            console.log('⚠️ Zillow API key not configured - using mock data');
            return this.getMockZillowData();
        }

        try {
            // Note: Zillow's public API was discontinued
            // This is a placeholder for when using Zillow's enterprise API
            console.log('⚠️ Zillow API integration requires enterprise access - using mock data');
            return this.getMockZillowData();
            
        } catch (error) {
            console.error('Zillow API error:', error.message);
            return this.getMockZillowData();
        }
    }

    /**
     * CoreLogic API (enterprise only)
     */
    async getCoreLogicValuation() {
        if (!this.apiKeys.corelogic) {
            console.log('⚠️ CoreLogic API key not configured - using mock data');
            return this.getMockCoreLogicData();
        }

        try {
            // Placeholder for CoreLogic API integration
            console.log('⚠️ CoreLogic API requires enterprise agreement - using mock data');
            return this.getMockCoreLogicData();
            
        } catch (error) {
            console.error('CoreLogic API error:', error.message);
            return this.getMockCoreLogicData();
        }
    }

    /**
     * Rentspree API (for rental market data)
     */
    async getRentspreeValuation() {
        if (!this.apiKeys.rentspree) {
            console.log('⚠️ Rentspree API key not configured');
            return null;
        }

        try {
            // Calculate property value based on rental yield
            console.log('⚠️ Rentspree API integration placeholder - not implemented yet');
            return null;
            
        } catch (error) {
            console.error('Rentspree API error:', error.message);
            return null;
        }
    }

    /**
     * Calculate weighted average valuation from multiple sources
     */
    calculateWeightedValuation(valuations) {
        let totalWeightedValue = 0;
        let totalWeight = 0;
        let totalConfidence = 0;

        valuations.forEach(val => {
            const weight = val.weight || (1 / valuations.length);
            totalWeightedValue += val.value * weight;
            totalWeight += weight;
            totalConfidence += val.confidence;
        });

        const weightedValue = totalWeightedValue / totalWeight;
        const averageConfidence = totalConfidence / valuations.length;

        // Calculate variance to determine reliability
        const variance = this.calculateVariance(valuations.map(v => v.value));
        const coefficientOfVariation = Math.sqrt(variance) / weightedValue;

        return {
            currentValue: Math.round(weightedValue),
            confidence: averageConfidence,
            variance: variance,
            coefficientOfVariation: coefficientOfVariation,
            sources: valuations,
            sourceCount: valuations.length,
            timestamp: new Date().toISOString(),
            isReliable: averageConfidence >= this.minConfidence && coefficientOfVariation < 0.15,
            metadata: {
                propertyAddress: this.propertyAddress,
                propertyId: this.propertyId,
                valuationMethod: 'weighted_average'
            }
        };
    }

    /**
     * Calculate variance of valuation values
     */
    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    }

    /**
     * Update XRPL ledger with new valuation data
     */
    async updateOnChainValuation(valuation) {
        if (!this.wallet || !this.client) {
            console.log('⚠️ Oracle wallet not configured, skipping on-chain update');
            return null;
        }

        try {
            console.log('📝 Updating on-chain valuation data...');

            const valuationData = {
                propertyValue: valuation.currentValue,
                confidence: valuation.confidence,
                timestamp: valuation.timestamp,
                sources: valuation.sourceCount,
                reliable: valuation.isReliable
            };

            const accountSet = {
                TransactionType: 'AccountSet',
                Account: this.wallet.address,
                Domain: this.stringToHex(JSON.stringify(valuationData))
            };

            const prepared = await this.client.autofill(accountSet);
            const signed = this.wallet.sign(prepared);
            const result = await this.client.submitAndWait(signed.tx_blob);

            if (result.result.meta.TransactionResult === 'tesSUCCESS') {
                console.log(`✅ On-chain valuation updated: $${valuation.currentValue.toLocaleString()}`);
                console.log(`   Transaction: ${result.result.hash}`);
                return result;
            } else {
                throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
            }

        } catch (error) {
            console.error('❌ Failed to update on-chain valuation:', error.message);
            return null;
        }
    }

    /**
     * Mock data generators for testing (when APIs are not available)
     */
    getMockZillowData() {
        // Generate realistic data around $1M with some variance
        const baseValue = 1000000;
        const variance = (Math.random() - 0.5) * 0.1; // ±5% variance
        
        return {
            source: 'Zillow (Mock)',
            value: Math.round(baseValue * (1 + variance)),
            confidence: 0.75 + Math.random() * 0.15,
            lastUpdated: new Date().toISOString(),
            weight: 0.3,
            details: { 
                note: 'Mock data for testing',
                variance: `${(variance * 100).toFixed(1)}%`
            }
        };
    }

    getMockCoreLogicData() {
        const baseValue = 1000000;
        const variance = (Math.random() - 0.5) * 0.08; // ±4% variance
        
        return {
            source: 'CoreLogic (Mock)',
            value: Math.round(baseValue * (1 + variance)),
            confidence: 0.80 + Math.random() * 0.10,
            lastUpdated: new Date().toISOString(),
            weight: 0.4,
            details: { 
                note: 'Mock data for testing',
                variance: `${(variance * 100).toFixed(1)}%`
            }
        };
    }

    /**
     * Utility function to convert string to hex
     */
    stringToHex(str) {
        return Buffer.from(str, 'utf8').toString('hex');
    }

    /**
     * Get oracle status
     */
    getStatus() {
        return {
            initialized: this.client !== null,
            connected: this.client && this.client.isConnected(),
            hasWallet: this.wallet !== null,
            lastUpdate: this.lastUpdate,
            hasCachedData: this.cachedValuation !== null
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.client && this.client.isConnected()) {
            await this.client.disconnect();
            console.log('🔌 Oracle XRPL connection closed');
        }
    }
}

module.exports = PropertyOracle;