/**
 * 24/7 USDT Offer Maintenance Bot for XRPL Real Estate Token (RLA)
 * 
 * This bot continuously monitors the XRPL DEX for active RLA/USDT offers
 * and automatically reposts them if they are filled, canceled, or missing.
 * 
 * Features:
 * - Monitors offers every 60 seconds (configurable)
 * - Automatically recreates missing offers
 * - Handles network errors and reconnections
 * - Detailed logging with timestamps
 * - Graceful shutdown handling
 */

const xrpl = require('xrpl');
require('dotenv').config();

// Configuration from environment variables
const NETWORK_URL = process.env.XRPL_NETWORK;
const ISSUER_SEED = process.env.ISSUER_SEED;
const RLA_TOKEN_CODE = process.env.RLA_TOKEN_CODE;
const RLA_AMOUNT = process.env.RLA_AMOUNT;
const USDT_AMOUNT = process.env.USDT_AMOUNT;
const USDT_ISSUER = process.env.USDT_ISSUER;
const USDT_TOKEN_CODE = process.env.USDT_TOKEN_CODE;
const CHECK_INTERVAL = (parseInt(process.env.CHECK_INTERVAL_SECONDS) || 60) * 1000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const ADMIN_FEE_PERCENTAGE = parseFloat(process.env.ADMIN_FEE_PERCENTAGE) || 2.5;
const ENABLE_ADMIN_FEE = process.env.ENABLE_ADMIN_FEE === 'true';

// Bot state
let isRunning = true;
let client = null;
let wallet = null;
let consecutiveErrors = 0;
let totalOffersCreated = 0;
let lastOfferHash = null;

/**
 * Logs messages with timestamp
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Message to log
 */
function log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Validates environment configuration
 */
function validateEnvironment() {
    const required = [
        'XRPL_NETWORK', 'ISSUER_SEED', 'RLA_TOKEN_CODE', 
        'RLA_AMOUNT', 'USDT_AMOUNT', 'USDT_ISSUER', 'USDT_TOKEN_CODE'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        log('ERROR', 'Missing required environment variables:');
        missing.forEach(key => log('ERROR', `   - ${key}`));
        process.exit(1);
    }
    
    log('INFO', 'Environment validation passed');
}

/**
 * Connects to XRPL with retry logic
 */
async function connectToXRPL() {
    let retries = 0;
    
    while (retries < MAX_RETRIES && isRunning) {
        try {
            if (client && client.isConnected()) {
                return client;
            }
            
            log('INFO', `Connecting to XRPL (attempt ${retries + 1}/${MAX_RETRIES})...`);
            client = new xrpl.Client(NETWORK_URL);
            await client.connect();
            
            log('INFO', 'Successfully connected to XRPL');
            consecutiveErrors = 0;
            return client;
            
        } catch (error) {
            retries++;
            log('ERROR', `Connection failed: ${error.message}`);
            
            if (retries < MAX_RETRIES) {
                const waitTime = Math.min(5000 * retries, 30000); // Exponential backoff, max 30s
                log('INFO', `Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw new Error('Failed to connect to XRPL after maximum retries');
}

/**
 * Gets all offers for the issuer account
 * @param {xrpl.Client} client - XRPL client
 * @param {string} account - Account address
 * @returns {Array} Array of offers
 */
async function getAccountOffers(client, account) {
    try {
        const response = await client.request({
            command: 'account_offers',
            account: account
        });
        
        return response.result.offers || [];
        
    } catch (error) {
        if (error.data && error.data.error === 'actNotFound') {
            log('WARN', 'Account not found or has no offers');
            return [];
        }
        throw error;
    }
}

/**
 * Checks if a specific RLA/USDT offer exists
 * @param {Array} offers - Array of offers from account_offers
 * @returns {Object|null} Matching offer or null
 */
function findTargetOffer(offers) {
    return offers.find(offer => {
        try {
            if (DEBUG_MODE) {
                log('DEBUG', `Examining offer: ${JSON.stringify(offer, null, 2)}`);
            }
            
            // Handle different offer formats (XRPL returns lowercase with underscores)
            let takerGets = offer.TakerGets || offer.taker_gets;
            let takerPays = offer.TakerPays || offer.taker_pays;
            
            // TakerGets could be a string (XRP) or object (token)
            if (typeof takerGets === 'string') {
                // This is an XRP offer, not our RLA offer
                return false;
            }
            
            // TakerPays could be a string (XRP) or object (token)  
            if (typeof takerPays === 'string') {
                // This is requesting XRP, not USDT
                return false;
            }
            
            // Check if this is our RLA/USDT offer
            const isRLAOffer = takerGets && 
                              takerGets.currency === RLA_TOKEN_CODE &&
                              takerGets.issuer === wallet.address;
                              
            const isUSDTRequest = takerPays &&
                                 takerPays.currency === USDT_TOKEN_CODE &&
                                 takerPays.issuer === USDT_ISSUER;
            
            if (!isRLAOffer || !isUSDTRequest) {
                return false;
            }
            
            // Check amounts (allowing for small differences due to partial fills)
            const rlaAmount = parseFloat(takerGets.value || '0');
            const usdtAmount = parseFloat(takerPays.value || '0');
            
            const targetRLA = parseFloat(RLA_AMOUNT);
            const targetUSDT = parseFloat(USDT_AMOUNT);
            
            // Consider it a match if it's at least 90% of the target amounts
            const rlaMatch = rlaAmount >= targetRLA * 0.9;
            const usdtMatch = usdtAmount >= targetUSDT * 0.9;
            
            if (DEBUG_MODE && (isRLAOffer || isUSDTRequest)) {
                log('DEBUG', `   RLA Amount: ${rlaAmount} (target: ${targetRLA}, match: ${rlaMatch})`);
                log('DEBUG', `   USDT Amount: ${usdtAmount} (target: ${targetUSDT}, match: ${usdtMatch})`);
            }
            
            return rlaMatch && usdtMatch;
            
        } catch (error) {
            log('ERROR', `Error examining offer: ${error.message}`);
            return false;
        }
    });
}

/**
 * Creates a new RLA/USDT offer
 * @param {xrpl.Client} client - XRPL client
 * @param {xrpl.Wallet} wallet - Issuer wallet
 * @returns {Object} Transaction result
 */
async function createOffer(client, wallet) {
    try {
        log('INFO', 'Creating new RLA/USDT offer...');
        
        // Calculate amounts (with admin fee if enabled)
        let offerRLAAmount = RLA_AMOUNT;
        let offerUSDTAmount = USDT_AMOUNT;
        
        if (ENABLE_ADMIN_FEE) {
            // Adjust the offer to account for admin fee
            const feeAmount = (parseFloat(USDT_AMOUNT) * ADMIN_FEE_PERCENTAGE / 100);
            offerUSDTAmount = (parseFloat(USDT_AMOUNT) - feeAmount).toString();
            log('INFO', `Admin fee enabled: ${ADMIN_FEE_PERCENTAGE}% (${feeAmount} USDT)`);
            log('INFO', `Adjusted offer: ${offerUSDTAmount} USDT for ${offerRLAAmount} RLA`);
        }
        
        // Define offer parameters
        const takerGets = {
            currency: RLA_TOKEN_CODE,
            issuer: wallet.address,
            value: offerRLAAmount
        };
        
        const takerPays = {
            currency: USDT_TOKEN_CODE,
            issuer: USDT_ISSUER,
            value: offerUSDTAmount
        };
        
        // Create transaction
        const transaction = {
            TransactionType: 'OfferCreate',
            Account: wallet.address,
            TakerGets: takerGets,
            TakerPays: takerPays
        };
        
        if (DEBUG_MODE) {
            log('DEBUG', `Transaction: ${JSON.stringify(transaction, null, 2)}`);
        }
        
        // Autofill, sign, and submit
        const prepared = await client.autofill(transaction);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            totalOffersCreated++;
            lastOfferHash = result.result.hash;
            
            log('INFO', '✅ Offer created successfully!');
            log('INFO', `   Transaction Hash: ${result.result.hash}`);
            log('INFO', `   Selling: ${offerRLAAmount} ${RLA_TOKEN_CODE}`);
            log('INFO', `   For: ${offerUSDTAmount} ${USDT_TOKEN_CODE}`);
            log('INFO', `   Rate: ${(parseFloat(offerUSDTAmount) / parseFloat(offerRLAAmount)).toFixed(6)} ${USDT_TOKEN_CODE}/${RLA_TOKEN_CODE}`);
            log('INFO', `   Total offers created: ${totalOffersCreated}`);
            
        } else {
            log('ERROR', `Offer creation failed: ${result.result.meta.TransactionResult}`);
            log('ERROR', `Transaction Hash: ${result.result.hash}`);
        }
        
        return result;
        
    } catch (error) {
        log('ERROR', `Error creating offer: ${error.message}`);
        throw error;
    }
}

/**
 * Main monitoring loop
 */
async function monitorOffers() {
    log('INFO', `Starting offer monitoring (checking every ${CHECK_INTERVAL / 1000} seconds)...`);
    
    while (isRunning) {
        try {
            // Ensure connection
            await connectToXRPL();
            
            // Get current offers
            log('INFO', 'Checking for existing offers...');
            const offers = await getAccountOffers(client, wallet.address);
            
            if (DEBUG_MODE) {
                log('DEBUG', `Found ${offers.length} total offers`);
            }
            
            // Look for our specific RLA/USDT offer
            const targetOffer = findTargetOffer(offers);
            
            if (targetOffer) {
                log('INFO', '✅ Target offer found and active');
                if (DEBUG_MODE) {
                    log('DEBUG', `   Offer sequence: ${targetOffer.seq}`);
                    
                    // Handle both naming conventions for debug output
                    const debugTakerGets = targetOffer.TakerGets || targetOffer.taker_gets;
                    const debugTakerPays = targetOffer.TakerPays || targetOffer.taker_pays;
                    
                    if (debugTakerGets && typeof debugTakerGets === 'object') {
                        log('DEBUG', `   TakerGets: ${debugTakerGets.value} ${debugTakerGets.currency}`);
                    }
                    if (debugTakerPays && typeof debugTakerPays === 'object') {
                        log('DEBUG', `   TakerPays: ${debugTakerPays.value} ${debugTakerPays.currency}`);
                    }
                }
            } else {
                log('WARN', '❌ Target offer not found - creating new offer');
                await createOffer(client, wallet);
            }
            
            consecutiveErrors = 0;
            
        } catch (error) {
            consecutiveErrors++;
            log('ERROR', `Monitoring error (${consecutiveErrors}/${MAX_RETRIES}): ${error.message}`);
            
            // If too many consecutive errors, try to reconnect
            if (consecutiveErrors >= MAX_RETRIES) {
                log('WARN', 'Too many consecutive errors, attempting to reconnect...');
                
                try {
                    if (client) {
                        await client.disconnect();
                    }
                } catch (e) {
                    // Ignore disconnect errors
                }
                
                client = null;
                consecutiveErrors = 0;
            }
        }
        
        // Wait before next check
        if (isRunning) {
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
        }
    }
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
    log('INFO', 'Shutting down bot...');
    isRunning = false;
    
    if (client && client.isConnected()) {
        try {
            await client.disconnect();
            log('INFO', 'Disconnected from XRPL');
        } catch (error) {
            log('ERROR', `Error disconnecting: ${error.message}`);
        }
    }
    
    log('INFO', `Bot statistics:`);
    log('INFO', `   Total offers created: ${totalOffersCreated}`);
    log('INFO', `   Last offer hash: ${lastOfferHash || 'None'}`);
    log('INFO', 'Bot shutdown complete');
    
    process.exit(0);
}

/**
 * Main bot execution
 */
async function main() {
    log('INFO', '🤖 XRPL USDT Offer Maintenance Bot Starting...');
    log('INFO', '=========================================');
    
    // Validate environment
    validateEnvironment();
    
    // Load wallet
    log('INFO', 'Loading issuer wallet...');
    wallet = xrpl.Wallet.fromSeed(ISSUER_SEED);
    log('INFO', `Wallet Address: ${wallet.address}`);
    
    // Log configuration
    log('INFO', 'Bot Configuration:');
    log('INFO', `   Network: ${NETWORK_URL}`);
    log('INFO', `   Check Interval: ${CHECK_INTERVAL / 1000} seconds`);
    log('INFO', `   Token: ${RLA_AMOUNT} ${RLA_TOKEN_CODE} -> ${USDT_AMOUNT} ${USDT_TOKEN_CODE}`);
    log('INFO', `   Admin Fee: ${ENABLE_ADMIN_FEE ? ADMIN_FEE_PERCENTAGE + '%' : 'Disabled'}`);
    log('INFO', `   Debug Mode: ${DEBUG_MODE ? 'Enabled' : 'Disabled'}`);
    
    // Setup signal handlers for graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGQUIT', shutdown);
    
    // Start monitoring
    try {
        await monitorOffers();
    } catch (error) {
        log('ERROR', `Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', `Unhandled Rejection: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log('ERROR', `Uncaught Exception: ${error.message}`);
    shutdown();
});

// Execute main function
if (require.main === module) {
    main().catch(error => {
        log('ERROR', `Bot startup failed: ${error.message}`);
        process.exit(1);
    });
}