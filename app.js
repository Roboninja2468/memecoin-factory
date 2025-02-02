// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};

// Constants
const MINT_SIZE = 82;
const BACKEND_URL = 'https://web-production-03b1e.up.railway.app';

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
        updateStatus('Creating your token...');
        
        // Create connection
        const connection = new solanaWeb3.Connection(
            'https://api.devnet.solana.com',
            'confirmed'
        );

        // Create mint account
        const mint = new solanaWeb3.Keypair();
        console.log('Mint account:', mint.publicKey.toString());

        // Get minimum balance for rent exemption
        const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

        // Create account
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.createAccount({
                fromPubkey: provider.publicKey,
                newAccountPubkey: mint.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TOKEN_PROGRAM_ID
            })
        );

        // Initialize mint
        transaction.add(
            splToken.createInitializeMintInstruction(
                TOKEN_PROGRAM_ID,
                mint.publicKey,
                decimals,
                provider.publicKey,
                provider.publicKey
            )
        );

        // Get associated token account
        const associatedAccount = await splToken.getAssociatedTokenAddress(
            mint.publicKey,
            provider.publicKey
        );

        // Create associated account
        transaction.add(
            splToken.createAssociatedTokenAccountInstruction(
                provider.publicKey,
                associatedAccount,
                provider.publicKey,
                mint.publicKey
            )
        );

        // Mint tokens
        const amount = supply * Math.pow(10, decimals);
        transaction.add(
            splToken.createMintToInstruction(
                mint.publicKey,
                associatedAccount,
                provider.publicKey,
                amount,
                [],
                TOKEN_PROGRAM_ID
            )
        );

        // Add authority revocation if selected
        if (options.revokeMint) {
            transaction.add(
                splToken.createSetAuthorityInstruction(
                    mint.publicKey,
                    provider.publicKey,
                    splToken.AuthorityType.MintTokens,
                    null,
                    [],
                    TOKEN_PROGRAM_ID
                )
            );
        }

        // Get recent blockhash
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = provider.publicKey;

        // Sign transaction
        transaction.sign(mint);
        const signed = await provider.signTransaction(transaction);

        // Send transaction
        updateStatus('Broadcasting transaction...');
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature);

        // Send data to backend
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
