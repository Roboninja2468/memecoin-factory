// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};

// Constants
const RAYDIUM_MAINNET_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const SERUM_MAINNET_PROGRAM_ID = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

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
        
        publicKey = resp.publicKey.toString();
        walletConnected = true;
        
        // Update UI
        document.getElementById('connectButton').textContent = 'Connected';
        updateStatus(`Connected: ${publicKey}`);
        
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

// Create token and list on Raydium
async function createAndListToken(name, symbol, supply, decimals) {
    try {
        updateStatus('Creating your token...');
        
        // Create connection to Solana network
        const connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl('mainnet-beta'),
            'confirmed'
        );

        // Generate new mint account
        const mintAccount = solanaWeb3.Keypair.generate();
        console.log('Mint account created:', mintAccount.publicKey.toString());

        // Calculate token supply with decimals
        const adjustedSupply = supply * Math.pow(10, decimals);

        // Create mint account transaction
        const createMintAccountIx = solanaWeb3.SystemProgram.createAccount({
            fromPubkey: provider.publicKey,
            newAccountPubkey: mintAccount.publicKey,
            space: solanaWeb3.MintLayout.span,
            lamports: await connection.getMinimumBalanceForRentExemption(solanaWeb3.MintLayout.span),
            programId: solanaWeb3.TOKEN_PROGRAM_ID
        });

        // Initialize mint instruction
        const initializeMintIx = solanaWeb3.Token.createInitMintInstruction(
            solanaWeb3.TOKEN_PROGRAM_ID,
            mintAccount.publicKey,
            decimals,
            provider.publicKey,
            provider.publicKey
        );

        // Create token account for the user
        const tokenAccount = await solanaWeb3.Token.getAssociatedTokenAddress(
            solanaWeb3.ASSOCIATED_TOKEN_PROGRAM_ID,
            solanaWeb3.TOKEN_PROGRAM_ID,
            mintAccount.publicKey,
            provider.publicKey
        );

        // Create associated token account instruction
        const createTokenAccountIx = solanaWeb3.Token.createAssociatedTokenAccountInstruction(
            solanaWeb3.ASSOCIATED_TOKEN_PROGRAM_ID,
            solanaWeb3.TOKEN_PROGRAM_ID,
            mintAccount.publicKey,
            tokenAccount,
            provider.publicKey,
            provider.publicKey
        );

        // Mint tokens to user's account
        const mintToIx = solanaWeb3.Token.createMintToInstruction(
            solanaWeb3.TOKEN_PROGRAM_ID,
            mintAccount.publicKey,
            tokenAccount,
            provider.publicKey,
            [],
            adjustedSupply
        );

        updateStatus('Creating Raydium liquidity pool...');

        // Create Raydium liquidity pool
        const { transaction: poolTx, signers: poolSigners } = await Liquidity.makeCreatePoolTransaction({
            connection,
            wallet: provider,
            mintA: mintAccount.publicKey, // Your token
            mintB: new solanaWeb3.PublicKey('So11111111111111111111111111111111111111112'), // SOL
            ammProgramId: new solanaWeb3.PublicKey(RAYDIUM_MAINNET_PROGRAM_ID),
            serumProgramId: new solanaWeb3.PublicKey(SERUM_MAINNET_PROGRAM_ID),
        });

        // Combine all transactions
        const transaction = new solanaWeb3.Transaction()
            .add(createMintAccountIx)
            .add(initializeMintIx)
            .add(createTokenAccountIx)
            .add(mintToIx)
            .add(poolTx);

        // Get recent blockhash
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = provider.publicKey;

        // Sign transaction
        const signedTx = await provider.signTransaction(transaction);
        signedTx.partialSign(...poolSigners, mintAccount);

        updateStatus('Broadcasting transaction...');

        // Send transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);

        updateStatus(`Success! Your token ${symbol} is now listed on Raydium! 
            Mint Address: ${mintAccount.publicKey.toString()}
            Transaction: ${signature}`);

        return {
            mint: mintAccount.publicKey.toString(),
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
    const name = document.getElementById('name').value.trim();
    const symbol = document.getElementById('symbol').value.trim();
    
    if (!name || !symbol || !uploadedImage) {
        updateStatus('Please fill in all fields and upload an image', true);
        return;
    }
    
    document.getElementById('pageOne').classList.remove('active');
    document.getElementById('pageTwo').classList.add('active');
    
    tokenFormData.name = name;
    tokenFormData.symbol = symbol;
});

// Back button
document.getElementById('backToBasicBtn').addEventListener('click', () => {
    document.getElementById('pageTwo').classList.remove('active');
    document.getElementById('pageOne').classList.add('active');
});

// Image upload
const imageInput = document.getElementById('tokenImage');
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const imageError = document.getElementById('imageError');
    const imagePreview = document.getElementById('imagePreview');
    
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

// Token creation form
document.getElementById('tokenFormDetails').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
        updateStatus('Please connect your wallet first', true);
        return;
    }

    const supply = document.getElementById('supply').value;
    const decimals = document.getElementById('decimals').value;

    if (!supply || supply <= 0) {
        updateStatus('Please enter a valid supply', true);
        return;
    }

    if (!decimals || decimals < 0 || decimals > 9) {
        updateStatus('Decimals must be between 0 and 9', true);
        return;
    }

    try {
        const result = await createAndListToken(
            tokenFormData.name,
            tokenFormData.symbol,
            supply,
            decimals
        );

        console.log('Token created and listed:', result);
    } catch (error) {
        console.error('Failed to create and list token:', error);
        updateStatus(`Failed to create token: ${error.message}`, true);
    }
});

// Helper function to update status with console logging
function updateStatus(message, isError = false) {
    console.log(`Status update (${isError ? 'error' : 'info'}):`, message);
    const statusBox = document.getElementById('status');
    statusBox.textContent = message;
    statusBox.style.color = isError ? 'var(--error)' : 'var(--success)';
}
