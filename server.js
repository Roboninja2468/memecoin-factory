const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Token creation route
app.post('/api/create-token', async (req, res) => {
    try {
        const { name, symbol, supply, decimals, options } = req.body;
        
        // Log the request
        console.log('Token creation request:', {
            name,
            symbol,
            supply,
            decimals,
            options
        });

        // Return success response
        res.json({
            success: true,
            message: 'Token creation request received',
            data: {
                name,
                symbol,
                supply,
                decimals
            }
        });
    } catch (error) {
        console.error('Token creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});