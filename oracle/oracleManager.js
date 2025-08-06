/**
 * oracle/oracleManager.js - Oracle Management System
 * 
 * Coordinates property oracle updates and integrates with the main bot
 */

const PropertyOracle = require('./propertyOracle');

class OracleManager {
    constructor(config = {}) {
        this.config = config;
        this.oracle = new PropertyOracle(config);
        this.updateInterval = parseInt(config.updateInterval || process.env.ORACLE_UPDATE_INTERVAL || '3600000');
        this.isRunning = false;
        this.lastValuation = null;
        this.updateTimer = null;
        
        // Callback functions
        this.onPriceUpdate = config.onPriceUpdate || (() => {});
        this.onError = config.onError || ((error) => console.error('Oracle error:', error));
        
        console.log(`🔮 Oracle Manager configured with ${this.updateInterval / 1000}s update interval`);
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Oracle Manager...');
            await this.oracle.initialize();
            
            // Get initial valuation
            this.lastValuation = await this.oracle.getPropertyValuation();
            console.log(`💰 Initial property value: $${this.lastValuation.currentValue.toLocaleString()}`);
            console.log(`📊 Confidence: ${(this.lastValuation.confidence * 100).toFixed(1)}%`);
            console.log(`🔍 Sources: ${this.lastValuation.sourceCount}`);
            
            console.log('✅ Oracle Manager initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Oracle Manager initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Start continuous oracle monitoring
     */
    async startMonitoring() {
        if (this.isRunning) {
            console.log('⚠️ Oracle monitoring already running');
            return;
        }

        this.isRunning = true;
        console.log(`🔄 Starting oracle monitoring (updates every ${this.updateInterval / 1000} seconds)`);
        
        // Schedule regular updates
        this.updateTimer = setInterval(async () => {
            await this.performUpdate();
        }, this.updateInterval);

        // Perform initial update if we don't have recent data
        if (!this.lastValuation || this.isDataStale()) {
            await this.performUpdate();
        }
    }

    /**
     * Stop oracle monitoring
     */
    stopMonitoring() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        console.log('🛑 Oracle monitoring stopped');
    }

    /**
     * Check if current data is stale
     */
    isDataStale() {
        if (!this.lastValuation || !this.lastValuation.timestamp) {
            return true;
        }
        
        const lastUpdateTime = new Date(this.lastValuation.timestamp).getTime();
        const staleThreshold = this.updateInterval * 2; // Data is stale if older than 2x update interval
        
        return (Date.now() - lastUpdateTime) > staleThreshold;
    }

    /**
     * Perform oracle update cycle
     */
    async performUpdate() {
        try {
            console.log('🔮 Performing oracle update...');
            const startTime = Date.now();
            
            const newValuation = await this.oracle.getPropertyValuation();
            
            if (!newValuation.isReliable) {
                console.warn(`⚠️ Valuation confidence too low: ${(newValuation.confidence * 100).toFixed(1)}% (threshold: ${(this.oracle.minConfidence * 100).toFixed(1)}%)`);
                console.warn('   Keeping previous valuation');
                return;
            }

            // Check if price changed significantly
            const priceChange = this.calculatePriceChange(this.lastValuation, newValuation);
            const priceChangePercent = priceChange * 100;
            
            console.log(`📈 Property valuation: $${newValuation.currentValue.toLocaleString()}`);
            console.log(`📊 Confidence: ${(newValuation.confidence * 100).toFixed(1)}%`);
            console.log(`🔍 Sources: ${newValuation.sourceCount}`);
            
            if (Math.abs(priceChange) > 0.01) { // 1% threshold
                console.log(`🚨 Significant price change detected: ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`);
                
                // Update on-chain data if wallet is configured
                await this.oracle.updateOnChainValuation(newValuation);
                
                // Notify the main bot of price change
                await this.onPriceUpdate({
                    oldValuation: this.lastValuation,
                    newValuation: newValuation,
                    priceChange: priceChange,
                    priceChangePercent: priceChangePercent,
                    shouldUpdateOffers: true,
                    timestamp: new Date().toISOString()
                });
                
            } else {
                console.log(`✅ Property value stable (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}% change)`);
            }
            
            this.lastValuation = newValuation;
            
            const duration = Date.now() - startTime;
            console.log(`⏱️ Oracle update completed in ${duration}ms`);
            
        } catch (error) {
            console.error('💥 Oracle update failed:', error.message);
            this.onError(error);
        }
    }

    /**
     * Calculate percentage price change
     */
    calculatePriceChange(oldVal, newVal) {
        if (!oldVal || !newVal) return 0;
        return (newVal.currentValue - oldVal.currentValue) / oldVal.currentValue;
    }

    /**
     * Get current property valuation
     */
    async getCurrentValuation() {
        // Return cached if recent, otherwise fetch new
        if (this.lastValuation && !this.isDataStale()) {
            return this.lastValuation;
        }
        
        console.log('🔄 Fetching fresh valuation data...');
        this.lastValuation = await this.oracle.getPropertyValuation();
        return this.lastValuation;
    }

    /**
     * Force immediate oracle update
     */
    async forceUpdate() {
        console.log('🔄 Forcing immediate oracle update...');
        await this.performUpdate();
        return this.lastValuation;
    }

    /**
     * Get oracle health status
     */
    getHealthStatus() {
        const oracleStatus = this.oracle.getStatus();
        
        return {
            manager: {
                isRunning: this.isRunning,
                updateInterval: this.updateInterval,
                nextUpdate: this.updateTimer ? Date.now() + this.updateInterval : null,
                lastUpdate: this.lastValuation?.timestamp,
                dataIsStale: this.isDataStale()
            },
            oracle: oracleStatus,
            valuation: this.lastValuation ? {
                currentValue: this.lastValuation.currentValue,
                confidence: this.lastValuation.confidence,
                sources: this.lastValuation.sourceCount,
                isReliable: this.lastValuation.isReliable,
                timestamp: this.lastValuation.timestamp
            } : null
        };
    }

    /**
     * Get formatted status for logging
     */
    getStatusSummary() {
        const status = this.getHealthStatus();
        
        return {
            status: this.isRunning ? 'RUNNING' : 'STOPPED',
            propertyValue: status.valuation ? `$${status.valuation.currentValue.toLocaleString()}` : 'N/A',
            confidence: status.valuation ? `${(status.valuation.confidence * 100).toFixed(1)}%` : 'N/A',
            sources: status.valuation ? status.valuation.sources : 0,
            lastUpdate: status.valuation ? status.valuation.timestamp : 'Never',
            nextUpdate: status.manager.nextUpdate ? new Date(status.manager.nextUpdate).toISOString() : 'N/A'
        };
    }

    /**
     * Set price update callback
     */
    setPriceUpdateCallback(callback) {
        this.onPriceUpdate = callback;
    }

    /**
     * Set error callback
     */
    setErrorCallback(callback) {
        this.onError = callback;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Oracle Manager...');
        this.stopMonitoring();
        await this.oracle.cleanup();
        console.log('✅ Oracle Manager cleanup completed');
    }
}

module.exports = OracleManager;