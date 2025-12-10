// Load environment variables from .env
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
// Enable CORS for frontend requests
app.use(cors()); 

// Configure Multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Define health check endpoint to verify API key presence
app.get('/health', (req, res) => {
    const hasKey = !!process.env.REMOVE_BG_KEY;
    res.json({ ok: true, removebg_key_present: hasKey });
});

// Handle image upload and forward to remove.bg API
app.post('/remove-bg', upload.single('file'), async (req, res) => {
try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Build form data with uploaded image
    const form = new FormData();
    form.append('image_file', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype || 'image/jpeg',
    });
    form.append('size', 'auto');

    // Send request to remove.bg API
    const response = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
    headers: {
        ...form.getHeaders(),
        'X-Api-Key': process.env.REMOVE_BG_KEY,
    },
    responseType: 'arraybuffer',
    validateStatus: () => true,
    });

    console.log('remove.bg status:', response.status);
    console.log('content-type:', response.headers['content-type']);

    if (response.status !== 200 || response.headers['content-type'] !== 'image/png') {
    // Return error info if background removal fails
    const bodyText = Buffer.from(response.data).toString('utf8');
    console.error('remove.bg error:', bodyText);
    return res.status(response.status).json({
        error: 'remove.bg failed',
        status: response.status,
        contentType: response.headers['content-type'],
        body: bodyText,
    });
    }

    // Send processed PNG back to client
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(response.data));
} catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: String(err) });
}
});
  
// Start Express server on configured port
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`RemoveBG proxy running on http://localhost:${port}`));
