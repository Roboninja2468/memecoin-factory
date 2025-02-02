const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
    res.send('Welcome to your Solana NFT project!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});