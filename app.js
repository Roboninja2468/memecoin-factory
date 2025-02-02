<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memecoin Factory</title>
    <link rel="stylesheet" href="styles.css">
    
    <!-- Buffer must be loaded first -->
    <script src="https://bundle.run/buffer@6.0.3"></script>
    <script>
        // Initialize Buffer global
        window.Buffer = buffer.Buffer;
    </script>

    <!-- Load Solana dependencies -->
    <script src="https://unpkg.com/@solana/web3.js@1.87.6/lib/index.iife.min.js"></script>
    <script src="https://unpkg.com/@solana/spl-token@0.3.8/lib/index.iife.min.js"></script>
    <script>
        // Wait for libraries to load
        window.addEventListener('load', async () => {
            try {
                console.log('Initializing libraries...');
                
                // Initialize connection to Solana devnet
                window.connection = new solanaWeb3.Connection(
                    'https://api.devnet.solana.com',
                    'confirmed'
                );
                
                // Initialize Token program
                window.TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                window.ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

                // Initialize Token object
                if (typeof spl_token !== 'undefined') {
                    window.Token = {
                        createInitializeMintInstruction: spl_token.createInitializeMintInstruction,
                        getAssociatedTokenAddress: spl_token.getAssociatedTokenAddress,
                        createAssociatedTokenAccountInstruction: spl_token.createAssociatedTokenAccountInstruction,
                        createMintToInstruction: spl_token.createMintToInstruction,
                        createSetAuthorityInstruction: spl_token.createSetAuthorityInstruction
                    };
                    console.log('SPL Token initialized:', window.Token);
                } else {
                    throw new Error('SPL Token library not loaded');
                }
                
                console.log('All libraries initialized successfully');
            } catch (error) {
                console.error('Error initializing libraries:', error);
                const statusElement = document.getElementById('status');
                if (statusElement) {
                    statusElement.textContent = `Failed to initialize: ${error.message}`;
                    statusElement.style.color = 'var(--error)';
                }
            }
        });
    </script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🪙 Memecoin Factory</h1>
            <button id="connectButton" class="btn">Connect Wallet</button>
        </header>

        <!-- Cost Estimation -->
        <div class="card cost-card">
            <h2>💰 Creation Costs</h2>
            <div class="cost-grid">
                <div class="cost-item">
                    <h3>Token Creation</h3>
                    <p>~0.005 SOL ($0.50)</p>
                    <small>One-time fee to create your token</small>
                </div>
                <div class="cost-item">
                    <h3>Raydium Listing</h3>
                    <p>~0.1-0.2 SOL ($10-20)</p>
                    <small>Fee to create liquidity pool</small>
                </div>
                <div class="cost-item recommended">
                    <h3>Initial Liquidity</h3>
                    <p>1-2 SOL recommended</p>
                    <small>Your initial liquidity (can be withdrawn)</small>
                </div>
            </div>
            <div class="cost-note">
                <p>💡 You'll need approximately 2-3 SOL total in your wallet</p>
                <small>Prices based on current SOL value (~$100/SOL)</small>
            </div>
        </div>
 
        <div class="card">
            <div id="pageOne" class="form-page active">
                <h2>Create Your Memecoin - Basic Info</h2>
                <form id="tokenFormBasic">
                    <div class="form-group">
                        <label for="name">Token Name</label>
                        <input type="text" id="name" required>
                    </div>
                    <div class="form-group">
                        <label for="symbol">Token Symbol</label>
                        <input type="text" id="symbol" required maxlength="5">
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="tokenImage">Token Image (max 5MB)</label>
                        <input type="file" id="tokenImage" accept="image/*">
                        <div id="imagePreview" class="image-preview"></div>
                        <small class="error" id="imageError"></small>
                    </div>
                    <div class="form-group">
                        <label>Social Links</label>
                        <input type="url" id="website" placeholder="Website URL (optional)">
                        <input type="text" id="twitter" placeholder="Twitter Username (optional)">
                        <input type="text" id="telegram" placeholder="Telegram Group (optional)">
                        <input type="text" id="discord" placeholder="Discord Invite (optional)">
                    </div>
                    <button type="button" id="nextToDetailsBtn" class="btn btn-primary">Next: Token Details</button>
                </form>
            </div>

            <div id="pageTwo" class="form-page">
                <h2>Create Your Memecoin - Token Details</h2>
                <form id="tokenFormDetails">
                    <div class="form-group">
                        <label for="supply">Total Supply</label>
                        <input type="number" id="supply" required>
                    </div>
                    <div class="form-group">
                        <label for="decimals">Decimals</label>
                        <input type="number" id="decimals" value="9" required>
                    </div>
                    <div class="form-group authority-options">
                        <h3>Authority Options (0.1 SOL each)</h3>
                        <div class="authority-grid">
                            <label class="checkbox-label">
                                <input type="checkbox" id="revokeMint">
                                <span class="checkbox-text">Revoke Mint Authority</span>
                                <span class="tooltip">Prevents creating more tokens in the future</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="revokeUpdate">
                                <span class="checkbox-text">Revoke Update Authority</span>
                                <span class="tooltip">Prevents updating token metadata</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="revokeFreeze">
                                <span class="checkbox-text">Revoke Freeze Authority</span>
                                <span class="tooltip">Prevents freezing token accounts</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-navigation">
                        <button type="button" id="backToBasicBtn" class="btn btn-secondary">Back</button>
                        <button type="submit" class="btn btn-primary">Create Token</button>
                    </div>
                </form>
            </div>
        </div>
 
        <div id="status" class="status-box"></div>
    </div>
    
    <!-- Load our app -->
    <script src="app.js" defer></script>
</body>
</html>
