\# XRPL USDT Bot - Usage Instructions \& Deployment Guide



\## 📋 Project Overview



This project provides two Node.js scripts for XRPL-based real estate tokenization:



1\. \*\*`usdtOffer.js`\*\* - Creates a one-time offer selling RLA tokens for USDT

2\. \*\*`usdtOfferBot.js`\*\* - 24/7 monitoring bot that maintains offers automatically



\## 🏗️ Project Structure



```

xrpl-usdt-bot/

├── .env                 # Environment configuration

├── usdtOffer.js         # One-time offer creation script

├── usdtOfferBot.js      # 24/7 monitoring bot

├── package.json         # Node.js dependencies

└── node\_modules/        # Installed packages

```



\## ⚙️ Configuration



\### Environment Variables (.env)



```bash

\# Network Configuration

XRPL\_NETWORK=wss://s.altnet.rippletest.net:51233  # Testnet

\# XRPL\_NETWORK=wss://xrplcluster.com              # Mainnet



\# Wallet Configuration

ISSUER\_SEED=your\_wallet\_seed\_here



\# Token Configuration

RLA\_TOKEN\_CODE=RLA

RLA\_AMOUNT=100000

USDT\_AMOUNT=70000

USDT\_ISSUER=rrrrrrrrrrrrrrrrrrrrBZbvji

USDT\_TOKEN\_CODE=USD



\# Optional Features

ADMIN\_FEE\_PERCENTAGE=2.5

ENABLE\_ADMIN\_FEE=false

DEBUG\_MODE=true



\# Bot Settings

CHECK\_INTERVAL\_SECONDS=60

MAX\_RETRIES=3

```



\## 🚀 Usage Instructions



\### Running the One-Time Offer Creation Script



```bash

\# Navigate to project directory

cd E:\\xrpl-usdt-bot



\# Create a single offer

node usdtOffer.js

```



\*\*When to use:\*\*

\- Initial offer creation

\- Manual offer posting

\- Testing offer creation



\### Running the 24/7 Monitoring Bot



```bash

\# Start the monitoring bot

node usdtOfferBot.js



\# Stop the bot

\# Press Ctrl+C for graceful shutdown

```



\*\*What the bot does:\*\*

\- ✅ Monitors offers every 60 seconds

\- ✅ Automatically recreates missing/filled offers

\- ✅ Handles network disconnections

\- ✅ Provides detailed logging

\- ✅ Graceful shutdown support



\### Running as a Background Service (Windows)



For 24/7 operation, you can run the bot as a Windows service:



```bash

\# Install PM2 (process manager)

npm install -g pm2



\# Start bot with PM2

pm2 start usdtOfferBot.js --name "xrpl-usdt-bot"



\# View logs

pm2 logs xrpl-usdt-bot



\# Stop the bot

pm2 stop xrpl-usdt-bot



\# Restart the bot

pm2 restart xrpl-usdt-bot



\# Auto-start on system boot

pm2 startup

pm2 save

```



\## 🔄 Switching from Testnet to Mainnet



\### Step 1: Update Network Configuration



Edit your `.env` file:



```bash

\# Change from Testnet to Mainnet

XRPL\_NETWORK=wss://xrplcluster.com



\# Alternative Mainnet endpoints:

\# XRPL\_NETWORK=wss://s1.ripple.com

\# XRPL\_NETWORK=wss://s2.ripple.com

```



\### Step 2: Update Wallet Configuration



```bash

\# Replace with your Mainnet wallet seed

ISSUER\_SEED=your\_mainnet\_wallet\_seed\_here

```



\### Step 3: Verify Token Settings



```bash

\# Ensure correct USDT issuer (should remain the same)

USDT\_ISSUER=rrrrrrrrrrrrrrrrrrrrBZbvji



\# Verify your RLA token code

RLA\_TOKEN\_CODE=RLA  # Your actual token code

```



\### Step 4: Test Before Production



```bash

\# Test with small amounts first

RLA\_AMOUNT=100      # Start with 100 RLA

USDT\_AMOUNT=70      # Start with 70 USDT



\# Run one-time offer first

node usdtOffer.js



\# If successful, update to full amounts and start bot

node usdtOfferBot.js

```



\## 🔧 Troubleshooting



\### Common Issues and Solutions



\#### 1. "Invalid seed" error

```bash

\# Ensure your seed is correct format

ISSUER\_SEED=sEdTM1uX8pu2do5XvTnutH6HsouMaM2  # Example format

```



\#### 2. "Insufficient XRP balance"

\- Ensure wallet has at least 10 XRP for reserve requirements

\- Add more XRP to cover transaction fees



\#### 3. "Trust line not found"

\- Liquidity providers need trust lines for both RLA and USDT

\- Create trust lines before offers can be taken



\#### 4. Connection errors

```bash

\# Try alternative endpoints

XRPL\_NETWORK=wss://s1.ripple.com

\# or

XRPL\_NETWORK=wss://s2.ripple.com

```



\#### 5. Bot keeps recreating offers

\- Check if offers are being filled immediately

\- Verify offer amounts match configuration

\- Review market conditions



\### Debugging Commands



```bash

\# Run with extra debugging

DEBUG\_MODE=true node usdtOfferBot.js



\# Check current offers manually

node -e "

const xrpl = require('xrpl');

(async () => {

&nbsp; const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');

&nbsp; await client.connect();

&nbsp; const offers = await client.request({

&nbsp;   command: 'account\_offers',

&nbsp;   account: 'your\_wallet\_address\_here'

&nbsp; });

&nbsp; console.log(JSON.stringify(offers.result.offers, null, 2));

&nbsp; await client.disconnect();

})();

"

```



\## 📊 Monitoring and Logs



\### Log Levels



\- \*\*INFO\*\*: General operation status

\- \*\*WARN\*\*: Non-critical issues

\- \*\*ERROR\*\*: Errors that need attention

\- \*\*DEBUG\*\*: Detailed debugging information



\### Key Log Messages



```

✅ Target offer found and active     # Offer exists, all good

❌ Target offer not found           # Creating new offer

🎉 Offer created successfully!      # New offer posted

💥 Connection failed                # Network issue

```



\### Performance Monitoring



```bash

\# Check bot statistics

\# Look for these in shutdown logs:

\#   Total offers created: X

\#   Last offer hash: XXXXX

```



\## 🔐 Security Best Practices



\### 1. Protect Your Seed

\- Never share your wallet seed

\- Store securely (encrypted backup)

\- Use environment variables, not hardcoded values



\### 2. Network Security

\- Use secure WebSocket connections (wss://)

\- Verify XRPL endpoint authenticity

\- Monitor for suspicious activity



\### 3. Operational Security

\- Start with small amounts for testing

\- Monitor logs regularly

\- Set up alerts for failures

\- Keep backups of configuration



\## 📈 Advanced Features



\### Admin Fee Configuration



```bash

\# Enable admin fees

ENABLE\_ADMIN\_FEE=true

ADMIN\_FEE\_PERCENTAGE=2.5



\# This adjusts offers to:

\# - Receive: 68,250 USDT (70,000 - 2.5%)

\# - Pay: 100,000 RLA

```



\### Custom Check Intervals



```bash

\# Check every 30 seconds (faster response)

CHECK\_INTERVAL\_SECONDS=30



\# Check every 5 minutes (less network usage)

CHECK\_INTERVAL\_SECONDS=300

```



\## 🎯 Production Deployment Checklist



\### Pre-Deployment

\- \[ ] Mainnet wallet funded with sufficient XRP

\- \[ ] RLA tokens issued and ready

\- \[ ] Trustlines verified for counterparties

\- \[ ] Configuration tested on Testnet

\- \[ ] Backup of wallet seed stored securely



\### Deployment

\- \[ ] Update `.env` for Mainnet

\- \[ ] Test with small amounts first

\- \[ ] Verify offers appear on DEX

\- \[ ] Start monitoring bot

\- \[ ] Set up process monitoring (PM2)

\- \[ ] Configure system startup scripts



\### Post-Deployment

\- \[ ] Monitor logs for errors

\- \[ ] Verify offers are maintained

\- \[ ] Check DEX for proper offer display

\- \[ ] Set up alerting for bot failures

\- \[ ] Document any custom configurations



\## 📞 Support and Maintenance



\### Regular Maintenance Tasks



1\. \*\*Weekly\*\*: Review bot logs for errors

2\. \*\*Monthly\*\*: Update Node.js dependencies

3\. \*\*Quarterly\*\*: Backup configuration and test recovery



\### Monitoring Commands



```bash

\# Check bot status

pm2 status



\# View recent logs

pm2 logs xrpl-usdt-bot --lines 50



\# Monitor in real-time

pm2 monit

```



\## 🔗 Useful Resources



\- \[XRPL Documentation](https://xrpl.org/)

\- \[XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)

\- \[XRPL Explorer](https://livenet.xrpl.org/) (Mainnet)

\- \[XRPL Testnet Explorer](https://testnet.xrpl.org/)

\- \[PM2 Documentation](https://pm2.keymetrics.io/docs/)



---



\## 🎉 Congratulations!



Your XRPL USDT offer creation and maintenance system is now ready for production use. The system provides:



\- ✅ Automated offer management

\- ✅ 24/7 monitoring and maintenance

\- ✅ Robust error handling

\- ✅ Easy Testnet to Mainnet migration

\- ✅ Comprehensive logging and debugging

\- ✅ Production-ready deployment options

