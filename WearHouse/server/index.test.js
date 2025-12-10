const request = require('supertest');
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

// Mock dependencies
jest.mock('axios');
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// We need to load the app after mocking
let app;

beforeAll(() => {
  // Set up environment variables
  process.env.REMOVE_BG_KEY = 'test-api-key';
  process.env.PORT = '3001';
  
  // Mock multer
  const upload = multer({ storage: multer.memoryStorage() });
  
  // Create Express app similar to index.js
  app = express();
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    const hasKey = !!process.env.REMOVE_BG_KEY;
    res.json({ ok: true, removebg_key_present: hasKey });
  });
  
  // Remove-bg endpoint
  app.post('/remove-bg', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const form = new FormData();
      form.append('image_file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype || 'image/jpeg',
      });
      form.append('size', 'auto');

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers: {
          ...form.getHeaders(),
          'X-Api-Key': process.env.REMOVE_BG_KEY,
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
      });

      if (response.status !== 200 || response.headers['content-type'] !== 'image/png') {
        const bodyText = Buffer.from(response.data).toString('utf8');
        return res.status(response.status).json({
          error: 'remove.bg failed',
          status: response.status,
          contentType: response.headers['content-type'],
          body: bodyText,
        });
      }

      res.set('Content-Type', 'image/png');
      res.send(Buffer.from(response.data));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error', details: String(err) });
    }
  });
});

describe('Server Health Check', () => {
  test('GET /health should return ok status and key presence', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      removebg_key_present: true
    });
  });

  test('GET /health should show false when key is missing', async () => {
    const originalKey = process.env.REMOVE_BG_KEY;
    delete process.env.REMOVE_BG_KEY;

    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.removebg_key_present).toBe(false);

    // Restore key
    process.env.REMOVE_BG_KEY = originalKey;
  });
});

describe('Remove Background Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REMOVE_BG_KEY = 'test-api-key';
  });

  test('POST /remove-bg should return 400 when no file is uploaded', async () => {
    const response = await request(app)
      .post('/remove-bg')
      .expect(400);

    expect(response.body).toEqual({ error: 'No file uploaded' });
  });

  test('POST /remove-bg should return processed image on success', async () => {
    // Mock successful axios response
    const mockImageBuffer = Buffer.from('fake-png-data');
    axios.post.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'image/png' },
      data: mockImageBuffer
    });

    const response = await request(app)
      .post('/remove-bg')
      .attach('file', Buffer.from('fake-image-data'), 'test.jpg')
      .expect(200);

    expect(response.headers['content-type']).toBe('image/png');
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.remove.bg/v1.0/removebg',
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Api-Key': 'test-api-key'
        }),
        responseType: 'arraybuffer'
      })
    );
  });

  test('POST /remove-bg should handle remove.bg API errors', async () => {
    // Mock error response from remove.bg
    axios.post.mockResolvedValue({
      status: 401,
      headers: { 'content-type': 'application/json' },
      data: Buffer.from(JSON.stringify({ error: 'Invalid API key' }))
    });

    const response = await request(app)
      .post('/remove-bg')
      .attach('file', Buffer.from('fake-image-data'), 'test.jpg')
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'remove.bg failed',
      status: 401
    });
  });

  test('POST /remove-bg should handle server errors', async () => {
    // Mock axios to throw an error
    axios.post.mockRejectedValue(new Error('Network error'));

    const response = await request(app)
      .post('/remove-bg')
      .attach('file', Buffer.from('fake-image-data'), 'test.jpg')
      .expect(500);

    expect(response.body).toMatchObject({
      error: 'Server error'
    });
  });
});

