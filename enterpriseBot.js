/**
 * enterpriseBot.js - Enterprise Real Estate Token Bot
 * 
 * Main bot that integrates XRPL trading, Oracle price feeds, and Fireblocks custody
 * to create a complete institutional-grade tokenized real estate platform.
 */

const xrpl = require('xrpl');
require('dotenv').config();

// Import our custom modules
const OracleManager = require('./oracle/oracleManager');
const FireblocksCustodyManager = require('./fireblocks/custodyManager');
const ComplianceReporter = require('./fireblocks/complianceReporter');

class EnterpriseRealEstateBot {
    constructor() {
        // XRPL Configuration
        this.xrplNetwork = process.env.XRPL_NETWORK;
        this.issuerSeed = process.env.ISSUER_SEED;
        this.tokenCode = process.env.RLA_TOKEN_CODE;
        this.rlaAmount = process.env.RLA_AMOUNT;
        this.usdtAmount = process.env.USDT_AMOUNT;
        this.usdtIssuer = process.env.USDT_ISSUER;
        this.usdtTokenCode = process.env.USDT_TOKEN_CODE;
        
        // Bot Configuration
        this.checkInterval = (parseInt(process.env.CHECK_INTERVAL_SECONDS) || 60) * 1000;
        this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
        this.debugMode = process.env.DEBUG_MODE === 'true';
        
        // Bot State
        this.isRunning = false;
        this.client = null;
        this.wallet = null;
        this.consecutiveErrors = 0;
        this.totalOffersCreated = 0;
        this.lastOfferHash = null;
        this.currentPrice = null;
        
        // Enterprise Components
        this.oracleManager = null;
        this.custodyManager = null;
        this.complianceReporter = null;
        
        // Statistics
        this.stats = {
            startTime: null,
            totalOffers: 0,
            priceUpdates: 0,
            custodyChecks: 0,
            complianceReports: 0,
            errors: 0
        };
    }

    /**
     * Initialize the complete enterprise system
     */
    async initialize() {
        try {
            console.log('🚀 ENTERPRISE REAL ESTATE TOKEN BOT STARTING...');
            console.log('================================================');
            
            this.stats.startTime = new Date();
            
            // 1. Initialize XRPL connection
            await this.initializeXRPL();
            
            // 2. Initialize Oracle system
            await this.initializeOracle();
            
            // 3. Initialize Fireblocks custody
            await this.initializeCustody();
            
            // 4. Initialize compliance reporting
            await this.initializeCompliance();
            
            // 5. Display configuration summary
            this.displayConfiguration();
            
            console.log('✅ Enterprise system initialization complete!');
            console.log('================================================\n');
            
            return true;
            
        } catch (error) {
            console.error('💥 Enterprise system initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Initialize XRPL connection and wallet
     */
    async initializeXRPL() {
        console.log('🌐 Initializing XRPL connection...');
        
        this.client = new xrpl.Client(this.xrplNetwork);
        await this.client.connect();
        
        this.wallet = xrpl.Wallet.fromSeed(this.issuerSeed);
        
        // Check wallet balance
        const accountInfo = await this.client.request({
            command: 'account_info',
            account: this.wallet.address
        });
        
        const xrpBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
        
        console.log(`   ✅ Connected to: ${this.xrplNetwork}`);
        console.log(`   🔑 Wallet: ${this.wallet.address}`);
        console.log(`   💰 Balance: ${xrpBalance} XRP`);
    }

    /**
     * Initialize Oracle system
     */
    async initializeOracle() {
        console.log('🔮 Initializing Oracle system...');
        
        if (process.env.ORACLE_ENABLED === 'true') {
            this.oracleManager = new OracleManager({
                updateInterval: process.env.ORACLE_UPDATE_INTERVAL,
                onPriceUpdate: this.handlePriceUpdate.bind(this),
                onError: this.handleOracleError.bind(this)
            });
            
            await this.oracleManager.initialize();
            
            // Get initial property valuation
            const valuation = await this.oracleManager.getCurrentValuation();
            this.currentPrice = this.calculateTokenPrice(valuation.currentValue);
            
            console.log(`   ✅ Oracle system active`);
            console.log(`   🏠 Property value: $${valuation.currentValue.toLocaleString()}`);
            console.log(`   💎 Token price: $${this.currentPrice.toFixed(4)}`);
        } else {
            console.log('   ⚠️ Oracle system disabled');
        }
    }

    /**
     * Initialize Fireblocks custody
     */
    async initializeCustody() {
        console.log('🏦 Initializing Fireblocks custody...');
        
        this.custodyManager = new FireblocksCustodyManager();
        await this.custodyManager.initialize();
        
        // Get initial custody verification
        const custodyStatus = await this.custodyManager.getCustodyVerification();
        
        console.log(`   ✅ Custody system: ${custodyStatus.custodian}`);
        console.log(`   🔒 Vault status: ${custodyStatus.status}`);
        console.log(`   📊 Compliance: ${custodyStatus.compliance.complianceScore}`);
    }

    /**
     * Initialize compliance reporting
     */
    async initializeCompliance() {
        console.log('📋 Initializing compliance reporting...');
        
        this.complianceReporter = new ComplianceReporter();
        await this.complianceReporter.initialize();
        
        console.log(`   ✅ Compliance system active`);
        console.log(`   📊 Report interval: ${process.env.REPORTING_INTERVAL / 3600000}h`);
    }

    /**
     * Display system configuration
     */
    displayConfiguration() {
        console.log('⚙️ SYSTEM CONFIGURATION:');
        console.log(`   Token: ${this.rlaAmount} ${this.tokenCode} → ${this.usdtAmount} ${this.usdtTokenCode}`);
        console.log(`   Check interval: ${this.checkInterval / 1000}s`);
        console.log(`   Oracle: ${process.env.ORACLE_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   Fireblocks: ${process.env.FIREBLOCKS_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   Compliance: ${process.env.ENABLE_COMPLIANCE_REPORTING === 'true' ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    /**
     * Start all enterprise monitoring systems
     */
    async startMonitoring() {
        if (this.isRunning) {
            console.log('⚠️ Enterprise monitoring already running');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Starting enterprise monitoring systems...\n');
        
        // Start all monitoring systems concurrently
        const monitoringPromises = [
            this.startOfferMonitoring(),
            this.startOracleMonitoring(),
            this.startCustodyMonitoring(),
            this.startComplianceReporting()
        ];

        try {
            await Promise.all(monitoringPromises);
        } catch (error) {
            console.error('💥 Enterprise monitoring startup failed:', error.message);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Start XRPL offer monitoring (core functionality)
     */
    async startOfferMonitoring() {
        console.log('📈 Starting XRPL offer monitoring...');
        
        while (this.isRunning) {
            try {
                await this.checkAndMaintainOffers();
                this.consecutiveErrors = 0;
                
            } catch (error) {
                this.consecutiveErrors++;
                this.stats.errors++;
                console.error(`💥 Offer monitoring error (${this.consecutiveErrors}/${this.maxRetries}): ${error.message}`);
                
                if (this.consecutiveErrors >= this.maxRetries) {
                    console.error('🚨 Too many consecutive errors, attempting reconnection...');
                    await this.handleConnectionFailure();
                }
            }
            
            if (this.isRunning) {
                await this.sleep(this.checkInterval);
            }
        }
    }

    /**
     * Start Oracle monitoring
     */
    async startOracleMonitoring() {
        if (this.oracleManager) {
            console.log('🔮 Starting Oracle monitoring...');
            await this.oracleManager.startMonitoring();
        }
    }

    /**
     * Start custody monitoring
     */
    async startCustodyMonitoring() {
        if (this.custodyManager) {
            console.log('🏦 Starting custody monitoring...');
            this.custodyManager.startMonitoring();
        }
    }

    /**
     * Start compliance reporting
     */
    async startComplianceReporting() {
        if (this.complianceReporter) {
            console.log('📋 Starting compliance reporting...');
            this.complianceReporter.startReporting();
        }
    }

    /**
     * Check and maintain XRPL offers
     */
    async checkAndMaintainOffers() {
        await this.ensureConnection();
        
        console.log(`[${new Date().toISOString()}] Checking offers...`);
        
        // Get current offers
        const offers = await this.getAccountOffers();
        const targetOffer = this.findTargetOffer(offers);
        
        if (targetOffer) {
            console.log('✅ Target offer found and active');
            if (this.debugMode) {
                this.logOfferDetails(targetOffer);
            }
        } else {
            console.log('❌ Target offer not found - creating new offer');
            await this.createOffer();
        }
    }

    /**
     * Get account offers from XRPL
     */
    async getAccountOffers() {
        try {
            const response = await this.client.request({
                command: 'account_offers',
                account: this.wallet.address
            });
            return response.result.offers || [];
        } catch (error) {
            if (error.data && error.data.error === 'actNotFound') {
                return [];
            }
            throw error;
        }
    }

    /**
     * Find our target RLA/USDT offer
     */
    findTargetOffer(offers) {
        return offers.find(offer => {
            try {
                const takerGets = offer.TakerGets || offer.taker_gets;
                const takerPays = offer.TakerPays || offer.taker_pays;
                
                if (typeof takerGets === 'string' || typeof takerPays === 'string') {
                    return false;
                }
                
                const isRLAOffer = takerGets && 
                                  takerGets.currency === this.tokenCode &&
                                  takerGets.issuer === this.wallet.address;
                                  
                const isUSDTRequest = takerPays &&
                                     takerPays.currency === this.usdtTokenCode &&
                                     takerPays.issuer === this.usdtIssuer;
                
                if (!isRLAOffer || !isUSDTRequest) {
                    return false;
                }
                
                const rlaAmount = parseFloat(takerGets.value || '0');
                const usdtAmount = parseFloat(takerPays.value || '0');
                const targetRLA = parseFloat(this.rlaAmount);
                const targetUSDT = parseFloat(this.usdtAmount);
                
                return rlaAmount >= targetRLA * 0.9 && usdtAmount >= targetUSDT * 0.9;
                
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Create new XRPL offer
     */
    async createOffer() {
        try {
            console.log('📝 Creating new RLA/USDT offer...');
            
            // Use current price if available from oracle
            const currentUSDTAmount = this.currentPrice ? 
                (parseFloat(this.rlaAmount) * this.currentPrice).toString() : 
                this.usdtAmount;
            
            const transaction = {
                TransactionType: 'OfferCreate',
                Account: this.wallet.address,
                TakerGets: {
                    currency: this.tokenCode,
                    issuer: this.wallet.address,
                    value: this.rlaAmount
                },
                TakerPays: {
                    currency: this.usdtTokenCode,
                    issuer: this.usdtIssuer,
                    value: currentUSDTAmount
                }
            };
            
            if (this.debugMode) {
                console.log('🔍 Transaction details:', JSON.stringify(transaction, null, 2));
            }
            
            const prepared = await this.client.autofill(transaction);
            const signed = this.wallet.sign(prepared);
            const result = await this.client.submitAndWait(signed.tx_blob);
            
            if (result.result.meta.TransactionResult === 'tesSUCCESS') {
                this.totalOffersCreated++;
                this.stats.totalOffers++;
                this.lastOfferHash = result.result.hash;
                
                console.log('🎉 Offer created successfully!');
                console.log(`   📊 Transaction: ${result.result.hash}`);
                console.log(`   💼 Selling: ${this.rlaAmount} ${this.tokenCode}`);
                console.log(`   💰 For: ${currentUSDTAmount} ${this.usdtTokenCode}`);
                console.log(`   📈 Rate: ${(parseFloat(currentUSDTAmount) / parseFloat(this.rlaAmount)).toFixed(6)}`);
                console.log(`   🎯 Total offers created: ${this.totalOffersCreated}`);
                
            } else {
                throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
            }
            
        } catch (error) {
            console.error('💥 Failed to create offer:', error.message);
            throw error;
        }
    }

    /**
     * Handle price update from oracle
     */
    async handlePriceUpdate(updateData) {
        try {
            console.log('🔮 Processing oracle price update...');
            console.log(`   📊 Price change: ${updateData.priceChangePercent > 0 ? '+' : ''}${updateData.priceChangePercent.toFixed(2)}%`);
            
            // Calculate new token price
            const newTokenPrice = this.calculateTokenPrice(updateData.newValuation.currentValue);
            
            if (Math.abs(newTokenPrice - this.currentPrice) / this.currentPrice > 0.01) { // 1% threshold
                console.log(`   💎 Updating token price: $${this.currentPrice?.toFixed(4)} → $${newTokenPrice.toFixed(4)}`);
                
                this.currentPrice = newTokenPrice;
                this.stats.priceUpdates++;
                
                // Cancel existing offers and create new ones with updated price
                await this.cancelAllOffers();
                await this.createOffer();
                
                console.log('✅ Price update completed');
            } else {
                console.log('   ℹ️ Price change too small, keeping current offers');
            }
            
        } catch (error) {
            console.error('💥 Failed to handle price update:', error.message);
        }
    }

    /**
     * Calculate token price based on property value
     */
    calculateTokenPrice(propertyValue) {
        const totalSupply = parseInt(process.env.TOTAL_TOKEN_SUPPLY || this.rlaAmount);
        return propertyValue / totalSupply;
    }

    /**
     * Cancel all existing offers
     */
    async cancelAllOffers() {
        try {
            const offers = await this.getAccountOffers();
            
            for (const offer of offers) {
                const cancelTx = {
                    TransactionType: 'OfferCancel',
                    Account: this.wallet.address,
                    OfferSequence: offer.seq
                };
                
                const prepared = await this.client.autofill(cancelTx);
                const signed = this.wallet.sign(prepared);
                await this.client.submitAndWait(signed.tx_blob);
                
                console.log(`   🗑️ Cancelled offer sequence: ${offer.seq}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Error cancelling offers:', error.message);
        }
    }

    /**
     * Handle oracle errors
     */
    handleOracleError(error) {
        console.error('🔮 Oracle error:', error.message);
        // Could send alerts here
    }

    /**
     * Handle connection failures
     */
    async handleConnectionFailure() {
        try {
            if (this.client) {
                await this.client.disconnect();
            }
            
            await this.sleep(5000);
            
            this.client = new xrpl.Client(this.xrplNetwork);
            await this.client.connect();
            
            this.consecutiveErrors = 0;
            console.log('✅ XRPL connection restored');
            
        } catch (error) {
            console.error('💥 Connection recovery failed:', error.message);
        }
    }

    /**
     * Ensure XRPL connection is active
     */
    async ensureConnection() {
        if (!this.client || !this.client.isConnected()) {
            console.log('🔄 Reconnecting to XRPL...');
            await this.handleConnectionFailure();
        }
    }

    /**
     * Log offer details for debugging
     */
    logOfferDetails(offer) {
        const takerGets = offer.TakerGets || offer.taker_gets;
        const takerPays = offer.TakerPays || offer.taker_pays;
        
        console.log(`   🔍 Offer sequence: ${offer.seq}`);
        if (takerGets && typeof takerGets === 'object') {
            console.log(`   📤 TakerGets: ${takerGets.value} ${takerGets.currency}`);
        }
        if (takerPays && typeof takerPays === 'object') {
            console.log(`   📥 TakerPays: ${takerPays.value} ${takerPays.currency}`);
        }
    }

    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
        
        return {
            system: {
                isRunning: this.isRunning,
                uptime: uptime,
                uptimeFormatted: this.formatUptime(uptime)
            },
            xrpl: {
                connected: this.client && this.client.isConnected(),
                network: this.xrplNetwork,
                wallet: this.wallet?.address,
                consecutiveErrors: this.consecutiveErrors
            },
            oracle: this.oracleManager ? this.oracleManager.getHealthStatus() : { status: 'DISABLED' },
            custody: this.custodyManager ? this.custodyManager.getCustodyStatusSummary() : { status: 'DISABLED' },
            compliance: this.complianceReporter ? this.complianceReporter.getReportingStatus() : { status: 'DISABLED' },
            statistics: {
                ...this.stats,
                currentPrice: this.currentPrice,
                lastOfferHash: this.lastOfferHash
            }
        };
    }

    /**
     * Format uptime for display
     */
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('\n🛑 Initiating graceful shutdown...');
        
        this.isRunning = false;
        
        // Stop all monitoring systems
        if (this.oracleManager) {
            await this.oracleManager.cleanup();
        }
        
        if (this.custodyManager) {
            await this.custodyManager.cleanup();
        }
        
        if (this.complianceReporter) {
            await this.complianceReporter.cleanup();
        }
        
        // Disconnect from XRPL
        if (this.client && this.client.isConnected()) {
            await this.client.disconnect();
            console.log('🔌 Disconnected from XRPL');
        }
        
        // Display final statistics
        const status = this.getSystemStatus();
        console.log('\n📊 FINAL STATISTICS:');
        console.log(`   ⏱️ Uptime: ${status.system.uptimeFormatted}`);
        console.log(`   🎯 Offers created: ${this.stats.totalOffers}`);
        console.log(`   📈 Price updates: ${this.stats.priceUpdates}`);
        console.log(`   🏦 Custody checks: ${this.stats.custodyChecks}`);
        console.log(`   📋 Compliance reports: ${this.stats.complianceReports}`);
        console.log(`   ❌ Errors: ${this.stats.errors}`);
        
        console.log('\n✅ Enterprise Real Estate Token Bot shutdown complete');
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    if (global.enterpriseBot) {
        await global.enterpriseBot.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (global.enterpriseBot) {
        await global.enterpriseBot.shutdown();
    }
    process.exit(0);
});

// Main execution
async function main() {
    try {
        global.enterpriseBot = new EnterpriseRealEstateBot();
        
        await global.enterpriseBot.initialize();
        await global.enterpriseBot.startMonitoring();
        
    } catch (error) {
        console.error('💥 Enterprise bot startup failed:', error.message);
        process.exit(1);
    }
}

// Run the bot
if (require.main === module) {
    main().catch(console.error);
}

module.exports = EnterpriseRealEstateBot;