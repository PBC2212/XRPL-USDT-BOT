/**
 * USDT Offer Creation Script for XRPL Real Estate Token (RLA)
 * 
 * This script creates an offer on the XRPL DEX to sell RLA tokens for USDT.
 * Offer Details:
 * - Sells: 100,000 RLA tokens
 * - Receives: 70,000 USDT
 * - Price: 0.70 USDT per RLA token
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
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

/**
 * Validates that all required environment variables are present
 */
function validateEnvironment() {
    const required = [
        'XRPL_NETWORK', 'ISSUER_SEED', 'RLA_TOKEN_CODE', 
        'RLA_AMOUNT', 'USDT_AMOUNT', 'USDT_ISSUER', 'USDT_TOKEN_CODE'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        process.exit(1);
    }
    
    console.log('✅ Environment validation passed');
}

/**
 * Creates and submits an OfferCreate transaction to the XRPL
 * @param {xrpl.Client} client - Connected XRPL client
 * @param {xrpl.Wallet} wallet - Issuer wallet
 */
async function createUSDTOffer(client, wallet) {
    try {
        console.log('📝 Preparing OfferCreate transaction...');
        
        // Define what we're giving (TakerGets) - RLA tokens
        const takerGets = {
            currency: RLA_TOKEN_CODE,
            issuer: wallet.address,
            value: RLA_AMOUNT
        };
        
        // Define what we want (TakerPays) - USDT tokens
        const takerPays = {
            currency: USDT_TOKEN_CODE,
            issuer: USDT_ISSUER,
            value: USDT_AMOUNT
        };
        
        // Create the OfferCreate transaction
        const offerTransaction = {
            TransactionType: 'OfferCreate',
            Account: wallet.address,
            TakerGets: takerGets,
            TakerPays: takerPays
        };
        
        if (DEBUG_MODE) {
            console.log('🔍 Transaction details:');
            console.log(`   Selling: ${RLA_AMOUNT} ${RLA_TOKEN_CODE} (${wallet.address})`);
            console.log(`   Buying: ${USDT_AMOUNT} ${USDT_TOKEN_CODE} (${USDT_ISSUER})`);
            console.log(`   Price: ${(USDT_AMOUNT / RLA_AMOUNT).toFixed(6)} ${USDT_TOKEN_CODE} per ${RLA_TOKEN_CODE}`);
        }
        
        // Autofill transaction details (fee, sequence, etc.)
        console.log('⚙️  Autofilling transaction...');
        const prepared = await client.autofill(offerTransaction);
        
        if (DEBUG_MODE) {
            console.log('📋 Prepared transaction:', JSON.stringify(prepared, null, 2));
        }
        
        // Sign the transaction
        console.log('✍️  Signing transaction...');
        const signed = wallet.sign(prepared);
        
        // Submit the transaction
        console.log('📤 Submitting transaction to XRPL...');
        const result = await client.submitAndWait(signed.tx_blob);
        
        // Check transaction result
        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log('🎉 SUCCESS! Offer created successfully!');
            console.log(`📊 Transaction Hash: ${result.result.hash}`);
            console.log(`🔗 Explorer: https://testnet.xrpl.org/transactions/${result.result.hash}`);
            
            // Extract offer details from metadata if available
            if (result.result.meta.CreatedNode) {
                const createdNodes = result.result.meta.CreatedNode;
                const offerNode = createdNodes.find(node => node.LedgerEntryType === 'Offer');
                if (offerNode && offerNode.NewFields) {
                    console.log(`💼 Offer Sequence: ${offerNode.NewFields.Sequence || 'N/A'}`);
                }
            }
            
            console.log('📈 Offer Details:');
            console.log(`   • Selling: ${RLA_AMOUNT} ${RLA_TOKEN_CODE}`);
            console.log(`   • For: ${USDT_AMOUNT} ${USDT_TOKEN_CODE}`);
            console.log(`   • Rate: ${(USDT_AMOUNT / RLA_AMOUNT).toFixed(6)} ${USDT_TOKEN_CODE}/${RLA_TOKEN_CODE}`);
            
        } else {
            console.error('❌ Transaction failed!');
            console.error(`   Result: ${result.result.meta.TransactionResult}`);
            console.error(`   Hash: ${result.result.hash}`);
            
            // Log additional error details if available
            if (result.result.meta && result.result.meta.TransactionResult) {
                console.error(`   Error Code: ${result.result.meta.TransactionResult}`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('💥 Error creating offer:');
        console.error(`   ${error.message}`);
        
        if (error.data && error.data.error_message) {
            console.error(`   XRPL Error: ${error.data.error_message}`);
        }
        
        throw error;
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('🚀 XRPL USDT Offer Creation Script Starting...\n');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize XRPL client
    console.log(`🌐 Connecting to XRPL network: ${NETWORK_URL}`);
    const client = new xrpl.Client(NETWORK_URL);
    
    try {
        // Connect to XRPL
        await client.connect();
        console.log('✅ Connected to XRPL successfully');
        
        // Load issuer wallet
        console.log('🔑 Loading issuer wallet...');
        const wallet = xrpl.Wallet.fromSeed(ISSUER_SEED);
        console.log(`   Wallet Address: ${wallet.address}`);
        
        // Check wallet balance and info
        console.log('💰 Checking wallet balance...');
        const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address
        });
        
        const xrpBalance = xrpl.dropsToXrp(accountInfo.result.account_data.Balance);
        console.log(`   XRP Balance: ${xrpBalance} XRP`);
        console.log(`   Sequence: ${accountInfo.result.account_data.Sequence}`);
        
        // Create the USDT offer
        await createUSDTOffer(client, wallet);
        
    } catch (error) {
        console.error('💥 Script execution failed:');
        console.error(`   ${error.message}`);
        process.exit(1);
        
    } finally {
        // Always disconnect
        console.log('\n🔌 Disconnecting from XRPL...');
        await client.disconnect();
        console.log('👋 Script completed');
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Execute main function
if (require.main === module) {
    main().catch(console.error);
}