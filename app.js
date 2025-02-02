// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};

// Constants
const MINT_SIZE = 82;
const BACKEND_URL = 'https://web-production-03b1e.up.railway.app';
const SOLANA_NETWORK = 'devnet';
const SOLANA_ENDPOINT = 'https://api.devnet.solana.com';

// Initialize event listeners
window.addEventListener('load', async () => {
    try {
        console.log('Initializing app...');
        
        // Check for Phantom wallet
        if (!provider) {
            provider = window?.phantom?.solana;
        }
        
        if (!provider) {
            throw new Error('Please install Phantom wallet to create tokens');
        }

        // Initialize Solana connection
        window.connection = new solanaWeb3.Connection(SOLANA_ENDPOINT, 'confirmed');
        
        // Initialize Token program IDs and class
        window.TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        window.ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
        window.Token = solanaWeb3.Token;
        
        // Set network to devnet
        if (provider.isPhantom) {
            await provider.connect({ onlyIfTrusted: true });
            await provider.request({
                method: "setDefaultNetwork",
                params: { network: SOLANA_NETWORK }
            });
        }
        
        console.log('App initialized successfully');
        updateStatus('Ready to create tokens');
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus(error.message, true);
    }
});

// Connect to Phantom wallet
async function connectWallet() {
    try {
        console.log('Connecting to Phantom...', provider);
        updateStatus('Connecting to wallet...');

        if (!provider) {
            throw new Error('Phantom wallet not found!');
        }

        // Request connection
        const resp = await provider.connect();
        console.log('Connection response:', resp);
        
        publicKey = resp.publicKey;
        walletConnected = true;
        
        // Update UI
        document.getElementById('connectButton').textContent = 'Connected';
        updateStatus(`Connected: ${publicKey.toString()}`);
        
        // Add disconnect handler
        provider.on('disconnect', () => {
            console.log('Wallet disconnected');
            publicKey = null;
            walletConnected = false;
            document.getElementById('connectButton').textContent = 'Connect Wallet';
            updateStatus('Wallet disconnected');
        });
        
        return true;
    } catch (error) {
        console.error('Connection error:', error);
        let errorMessage = 'Connection failed: ';
        
        if (error.code === 4001) {
            errorMessage += 'You rejected the connection request';
        } else if (!provider) {
            errorMessage += 'Please install Phantom wallet';
        } else {
            errorMessage += error.message;
        }
        
        updateStatus(errorMessage, true);
        return false;
    }
}

// Create token
async function createToken(name, symbol, supply, decimals, options = {}) {
    try {
        if (!walletConnected) {
            throw new Error('Please connect your wallet first');
        }

        if (!window.connection) {
            throw new Error('Solana connection not initialized');
        }

        if (!window.Token) {
            throw new Error('Token library not initialized. Please refresh the page.');
        }

        updateStatus('Creating your token...');

        // Create mint account
        const mint = solanaWeb3.Keypair.generate();
        console.log('Creating mint account:', mint.publicKey.toString());

        // Get minimum balance for rent exemption
        const lamports = await window.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

        // Create transaction
        const transaction = new solanaWeb3.Transaction();

        // Add create account instruction
        transaction.add(
            solanaWeb3.SystemProgram.createAccount({
                fromPubkey: provider.publicKey,
                newAccountPubkey: mint.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: window.TOKEN_PROGRAM_ID
            })
        );

        console.log('Initializing mint...');
        // Initialize mint
        transaction.add(
            window.Token.createInitializeMintInstruction(
                window.TOKEN_PROGRAM_ID,
                mint.publicKey,
                decimals,
                provider.publicKey,
                provider.publicKey
            )
        );

        // Get associated token account
        console.log('Creating associated token account...');
        const associatedAccount = await window.Token.getAssociatedTokenAddress(
            mint.publicKey,
            provider.publicKey,
            false,
            window.TOKEN_PROGRAM_ID,
            window.ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Create associated account
        transaction.add(
            window.Token.createAssociatedTokenAccountInstruction(
                provider.publicKey,
                associatedAccount,
                provider.publicKey,
                mint.publicKey,
                window.TOKEN_PROGRAM_ID,
                window.ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );

        // Mint tokens
        console.log(`Minting ${supply} tokens...`);
        const amount = supply * Math.pow(10, decimals);
        transaction.add(
            window.Token.createMintToInstruction(
                window.TOKEN_PROGRAM_ID,
                mint.publicKey,
                associatedAccount,
                provider.publicKey,
                [],
                amount
            )
        );

        // Add authority revocation if selected
        if (options.revokeMint) {
            console.log('Revoking mint authority...');
            transaction.add(
                window.Token.createSetAuthorityInstruction(
                    window.TOKEN_PROGRAM_ID,
                    mint.publicKey,
                    null,
                    'MintTokens',
                    provider.publicKey,
                    []
                )
            );
        }

        // Get recent blockhash
        const { blockhash } = await window.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = provider.publicKey;

        // Sign transaction
        console.log('Signing transaction...');
        transaction.sign(mint);
        const signed = await provider.signTransaction(transaction);

        // Send transaction
        console.log('Broadcasting transaction...');
        updateStatus('Broadcasting transaction...');
        const signature = await window.connection.sendRawTransaction(signed.serialize());
        
        console.log('Confirming transaction...');
        updateStatus('Confirming transaction...');
        const confirmation = await window.connection.confirmTransaction(signature);
        
        if (confirmation.value.err) {
            throw new Error('Transaction failed to confirm');
        }

        // Send data to backend
        console.log('Recording token creation...');
        const response = await fetch(`${BACKEND_URL}/api/create-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                symbol,
                supply,
                decimals,
                options,
                mintAddress: mint.publicKey.toString(),
                signature
            })
        });

        if (!response.ok) {
            throw new Error('Failed to record token creation');
        }

        // Build social links
        const socialLinks = [];
        if (options.website) socialLinks.push(`Website: ${options.website}`);
        if (options.twitter) socialLinks.push(`Twitter: https://twitter.com/${options.twitter}`);
        if (options.telegram) socialLinks.push(`Telegram: https://t.me/${options.telegram}`);
        if (options.discord) socialLinks.push(`Discord: ${options.discord}`);

        // Success message
        const successMessage = `
Token created successfully!

Token Address: ${mint.publicKey.toString()}
Transaction: ${signature}

Authority Status:
${options.revokeMint ? '✅' : '❌'} Mint Authority Revoked
${options.revokeUpdate ? '✅' : '❌'} Update Authority Revoked
${options.revokeFreeze ? '✅' : '❌'} Freeze Authority Revoked

${socialLinks.length > 0 ? '\nSocial Links:\n' + socialLinks.join('\n') : ''}

To list on Raydium:
1. Go to raydium.io
2. Click "Liquidity" -> "Add Liquidity"
3. Select your token using the address above
4. Add SOL and token amount for initial liquidity
5. Complete the transaction

Save your token address: ${mint.publicKey.toString()}`;

        updateStatus(successMessage);
        return {
            address: mint.publicKey.toString(),
            transaction: signature
        };
    } catch (error) {
        console.error('Token creation error:', error);
        updateStatus(`Failed to create token: ${error.message}`, true);
        throw error;
    }
}

// Initialize event listeners
console.log('Initializing app with provider:', provider);

// Connect wallet button
const connectButton = document.getElementById('connectButton');
connectButton.addEventListener('click', async () => {
    console.log('Connect button clicked');
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
    
    const connected = await connectWallet();
    
    if (!connected) {
        connectButton.textContent = 'Connect Wallet';
        connectButton.disabled = false;
    }
});

// Page navigation
document.getElementById('nextToDetailsBtn').addEventListener('click', () => {
    const name = getFormValue('name');
    const symbol = getFormValue('symbol');
    const description = getFormValue('description');
    
    if (!name || !symbol || !description || !uploadedImage) {
        updateStatus('Please fill in all required fields and upload an image', true);
        return;
    }
    
    document.getElementById('pageOne').classList.remove('active');
    document.getElementById('pageTwo').classList.add('active');
    
    tokenFormData = {
        name,
        symbol,
        description,
        website: getFormValue('website'),
        twitter: getFormValue('twitter'),
        telegram: getFormValue('telegram'),
        discord: getFormValue('discord')
    };
});

// Back button
document.getElementById('backToBasicBtn').addEventListener('click', () => {
    document.getElementById('pageTwo').classList.remove('active');
    document.getElementById('pageOne').classList.add('active');
});

// Image upload
const imageInput = document.getElementById('tokenImage');
if (imageInput) {
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const imageError = document.getElementById('imageError');
        const imagePreview = document.getElementById('imagePreview');
        
        if (!imageError || !imagePreview) return;
        
        imageError.textContent = '';
        
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                imageError.textContent = 'File is too large. Maximum size is 5MB.';
                imageInput.value = '';
                imagePreview.innerHTML = '';
                uploadedImage = null;
                return;
            }

            if (!file.type.startsWith('image/')) {
                imageError.textContent = 'Please upload a valid image file.';
                imageInput.value = '';
                imagePreview.innerHTML = '';
                uploadedImage = null;
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px;">`;
            };
            reader.readAsDataURL(file);
            uploadedImage = file;
        }
    });
}

// Helper functions
function getFormValue(id, defaultValue = '') {
    const element = document.getElementById(id);
    return element ? element.value.trim() : defaultValue;
}

function getCheckboxState(id, defaultState = false) {
    const element = document.getElementById(id);
    return element ? element.checked : defaultState;
}

// Token creation form
const tokenForm = document.getElementById('tokenFormDetails');
if (tokenForm) {
    tokenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!walletConnected) {
            updateStatus('Please connect your wallet first', true);
            return;
        }

        const supply = getFormValue('supply');
        const decimals = getFormValue('decimals', '9');

        if (!supply || supply <= 0) {
            updateStatus('Please enter a valid supply', true);
            return;
        }

        if (!decimals || decimals < 0 || decimals > 9) {
            updateStatus('Decimals must be between 0 and 9', true);
            return;
        }

        try {
            const options = {
                revokeMint: getCheckboxState('revokeMint'),
                revokeUpdate: getCheckboxState('revokeUpdate'),
                revokeFreeze: getCheckboxState('revokeFreeze'),
                ...tokenFormData
            };

            const result = await createToken(
                tokenFormData.name,
                tokenFormData.symbol,
                supply,
                decimals,
                options
            );

            console.log('Token created:', result);
        } catch (error) {
            console.error('Failed to create token:', error);
            updateStatus(`Failed to create token: ${error.message}`, true);
        }
    });
}

// Helper function to update status with console logging
function updateStatus(message, isError = false) {
    console.log(`Status update (${isError ? 'error' : 'info'}):`, message);
    const statusBox = document.getElementById('status');
    if (statusBox) {
        statusBox.textContent = message;
        statusBox.style.color = isError ? 'var(--error)' : 'var(--success)';
    }
}
