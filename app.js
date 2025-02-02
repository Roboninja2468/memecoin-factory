// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};
let metaplex = null;

// Constants
const MINT_SIZE = 82;
const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const METADATA_PROGRAM_ID = new solanaWeb3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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

        // Initialize Metaplex
        const connection = new solanaWeb3.Connection('https://api.devnet.solana.com');
        metaplex = Metaplex.make(connection)
            .use(keypairIdentity(solanaWeb3.Keypair.generate()))
            .use(bundlrStorage());
        
        // Update UI
        document.getElementById('connectButton').textContent = 'Connected';
        updateStatus(`Connected: ${publicKey.toString()}`);
        
        // Add disconnect handler
        provider.on('disconnect', () => {
            console.log('Wallet disconnected');
            publicKey = null;
            walletConnected = false;
            metaplex = null;
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

// Create token with metadata
async function createToken(name, symbol, supply, decimals) {
    try {
        if (!metaplex) {
            throw new Error('Metaplex not initialized. Please reconnect wallet.');
        }

        updateStatus('Creating your token...');
        
        // Upload image if provided
        let imageUri = null;
        if (uploadedImage) {
            const imageBuffer = await uploadedImage.arrayBuffer();
            const { uri } = await metaplex.storage().upload(imageBuffer);
            imageUri = uri;
        }

        // Create token with metadata
        const { nft } = await metaplex.nfts().create({
            uri: imageUri,
            name,
            symbol,
            sellerFeeBasisPoints: 0,
            isCollection: false,
            tokenStandard: 'fungible',
            decimals,
            supply: new solanaWeb3.BN(supply * Math.pow(10, decimals)),
            creators: [{ address: publicKey, share: 100 }],
            collection: null,
            uses: null,
        });

        // Success message with Raydium instructions
        const successMessage = `
Token created successfully!

Token Address: ${nft.address.toString()}
Metadata Address: ${nft.metadataAddress.toString()}

To list on Raydium:
1. Go to raydium.io
2. Click "Liquidity" -> "Add Liquidity"
3. Select your token using the address above
4. Add SOL and token amount for initial liquidity
5. Complete the transaction

Save your token address: ${nft.address.toString()}`;

        updateStatus(successMessage);
        console.log('Token created:', {
            address: nft.address.toString(),
            metadata: nft.metadataAddress.toString(),
            name,
            symbol,
            supply,
            decimals
        });

        return {
            address: nft.address.toString(),
            metadata: nft.metadataAddress.toString()
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
    const description = document.getElementById('description').value.trim();
    
    if (!name || !symbol || !description || !uploadedImage) {
        updateStatus('Please fill in all fields and upload an image', true);
        return;
    }
    
    document.getElementById('pageOne').classList.remove('active');
    document.getElementById('pageTwo').classList.add('active');
    
    tokenFormData.name = name;
    tokenFormData.symbol = symbol;
    tokenFormData.description = description;
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
