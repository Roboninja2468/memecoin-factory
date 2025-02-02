// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};

// Constants
const MINT_SIZE = 82;
const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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
async function createToken(name, symbol, supply, decimals) {
    try {
        updateStatus('Creating your token...');
        
        // Create connection
        const connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl('mainnet-beta'),
            'confirmed'
        );

        // Generate mint account
        const mintKeypair = solanaWeb3.Keypair.generate();
        console.log('Mint account:', mintKeypair.publicKey.toString());

        // Calculate rent exempt amount
        const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

        // Create account instruction
        const createAccountIx = solanaWeb3.SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            lamports: rentExemptAmount,
            space: MINT_SIZE,
            programId: TOKEN_PROGRAM_ID
        });

        // Initialize mint instruction
        const initMintIx = splToken.createInitializeMintInstruction(
            mintKeypair.publicKey,
            decimals,
            publicKey,
            publicKey,
            TOKEN_PROGRAM_ID
        );

        // Get associated token account
        const associatedTokenAccount = await splToken.getAssociatedTokenAddress(
            mintKeypair.publicKey,
            publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Create associated token account instruction
        const createAssociatedTokenAccountIx = splToken.createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAccount,
            publicKey,
            mintKeypair.publicKey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Calculate token amount with decimals
        const tokenAmount = supply * Math.pow(10, decimals);

        // Mint to instruction
        const mintToIx = splToken.createMintToInstruction(
            mintKeypair.publicKey,
            associatedTokenAccount,
            publicKey,
            tokenAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        // Create transaction
        const transaction = new solanaWeb3.Transaction().add(
            createAccountIx,
            initMintIx,
            createAssociatedTokenAccountIx,
            mintToIx
        );

        // Get recent blockhash
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Sign transaction
        transaction.sign(mintKeypair);
        const signedTx = await provider.signTransaction(transaction);

        // Send transaction
        updateStatus('Broadcasting transaction...');
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);

        // Success message with Raydium instructions
        const successMessage = `
Token created successfully!

Token Address: ${mintKeypair.publicKey.toString()}
Transaction: ${signature}

To list on Raydium:
1. Go to raydium.io
2. Click "Liquidity" -> "Add Liquidity"
3. Select your token using the address above
4. Add SOL and token amount for initial liquidity
5. Complete the transaction

Save your token address: ${mintKeypair.publicKey.toString()}`;

        updateStatus(successMessage);
        console.log('Token created:', {
            address: mintKeypair.publicKey.toString(),
            transaction: signature,
            name,
            symbol,
            supply,
            decimals
        });

        return {
            address: mintKeypair.publicKey.toString(),
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
        const result = await createToken(
            tokenFormData.name,
            tokenFormData.symbol,
            supply,
            decimals
        );

        console.log('Token created:', result);
    } catch (error) {
        console.error('Failed to create token:', error);
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
