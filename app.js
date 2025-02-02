// Global state
let provider = window.solana;
let walletConnected = false;
let publicKey = null;
let uploadedImage = null;
let tokenFormData = {};

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
        updateStatus('Creating token...');
        // Token creation logic will be implemented here
        console.log('Creating token with:', {
            name: tokenFormData.name,
            symbol: tokenFormData.symbol,
            supply,
            decimals
        });
    } catch (error) {
        console.error('Token creation failed:', error);
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
