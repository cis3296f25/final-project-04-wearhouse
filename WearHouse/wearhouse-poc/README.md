# WearHouse POC

WearHouse is a smart outfit suggestion app that uses weather data and calendar events to help you pick the perfect outfit.

## Features

- Upload clothing items with automatic background removal
- Weather-based outfit suggestions using real-time weather data
- Calendar integration for event-appropriate outfit recommendations
- Smart color and formality matching

## API Setup

### Weather API (OpenWeatherMap)

To enable real weather data:

1. Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
2. Create a `.env` file in the `wearhouse-poc` directory (if it doesn't exist)
3. Add your API key:
   ```
   VITE_WEATHER_API_KEY=your_api_key_here
   ```

**Note:** The app will work without this key but will use mock weather data instead.

### Google Calendar API (Optional)

To enable calendar event integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Google Calendar API" for your project
4. Create an API key (or use OAuth for private calendars)
5. Add to your `.env` file:
   ```
   VITE_GOOGLE_CALENDAR_API_KEY=your_api_key_here
   VITE_GOOGLE_CALENDAR_ID=primary
   ```

**Note:** 
- Using just an API key works for **public calendars only**
- For private calendars, you'll need to implement OAuth authentication
- Leave these variables unset to use mock calendar data

## Environment Variables

Create a `.env` file in the `wearhouse-poc` directory:

```env
# Supabase (required)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON=your_supabase_anon_key

# Weather API (optional - falls back to mock if not set)
VITE_WEATHER_API_KEY=your_openweathermap_api_key

# Google Calendar API (optional - falls back to mock if not set)
VITE_GOOGLE_CALENDAR_API_KEY=your_google_calendar_api_key
VITE_GOOGLE_CALENDAR_ID=primary
```

## Development

```bash
npm install
npm run dev
```

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
