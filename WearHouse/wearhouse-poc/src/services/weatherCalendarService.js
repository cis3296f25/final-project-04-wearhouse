/**
 * Weather and Calendar Integration Service
 * Handles fetching weather data and calendar events for outfit suggestions
 * 
 * Environment Variables Required:
 * - VITE_WEATHER_API_KEY: OpenWeatherMap API key (get free at https://openweathermap.org/api)
 * - VITE_GOOGLE_CALENDAR_API_KEY: Google Calendar API key (optional, for calendar integration)
 * - VITE_GOOGLE_CALENDAR_ID: Your Google Calendar ID (optional)
 */

/**
 * Get current weather data from OpenWeatherMap API
 * @param {Object} options - Configuration options
 * @param {number} options.lat - Latitude (optional, will use geolocation or default)
 * @param {number} options.lon - Longitude (optional, will use geolocation or default)
 * @returns {Promise<Object>} Weather data with tempF and condition
 */
export async function getWeather(options = {}) {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  
  // If no API key, fall back to mock
  if (!apiKey) {
    console.warn('VITE_WEATHER_API_KEY not set, using mock weather data');
    return getMockWeather();
  }

  try {
    let { lat, lon } = options;

    // Get user's location if not provided
    if (!lat || !lon) {
      try {
        const position = await getUserLocation();
        lat = position.lat;
        lon = position.lon;
      } catch (error) {
        console.warn('Could not get user location, using default (London)', error);
        // Default to London if geolocation fails
        lat = 51.5074;
        lon = -0.1278;
      }
    }

    // Fetch weather from OpenWeatherMap
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorMessage = `Weather API error: ${response.status} ${response.statusText}`;
      
      // Provide helpful messages for common errors
      if (response.status === 401) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // Sometimes response might not be JSON
          errorData = { message: 'Invalid API key' };
        }
        
        const errorDetail = errorData.message || errorData.reason || 'Invalid API key';
        console.error('OpenWeatherMap Error Response:', errorData);
        
        errorMessage = `401 Unauthorized: ${errorDetail}\n\n` +
          `✅ This endpoint (/data/2.5/weather) is FREE tier compatible.\n\n` +
          `The issue is with your API key. Please:\n` +
          `1. Go to https://home.openweathermap.org/api_keys\n` +
          `2. Check if your key shows "Active" status\n` +
          `3. Copy the key again (should be 32 characters)\n` +
          `4. New keys need 10-60 minutes to activate after signup\n` +
          `5. Make sure you activated your email from OpenWeatherMap\n` +
          `6. Your .env should look like: VITE_WEATHER_API_KEY=your_32_char_key\n\n` +
          `Error details: ${JSON.stringify(errorData)}`;
      } else if (response.status === 429) {
        errorMessage = `429 Too Many Requests: API rate limit exceeded.\nFree tier allows 60 calls/minute. Please wait a moment.`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Transform OpenWeatherMap response to our format
    return {
      tempF: Math.round(data.main.temp),
      tempC: Math.round((data.main.temp - 32) * 5/9),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
      feelsLike: Math.round(data.main.feels_like),
      location: data.name
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Fall back to mock on error
    console.warn('Falling back to mock weather data');
    return getMockWeather();
  }
}

/**
 * Get user's current location using browser geolocation API
 * @returns {Promise<Object>} Object with lat and lon
 */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        timeout: 5000,
        enableHighAccuracy: false
      }
    );
  });
}

/**
 * Get calendar event for a specific date from Google Calendar API
 * @param {Date} date - Date to fetch events for (defaults to today)
 * @returns {Promise<Object>} Calendar event with title and formality
 */
export async function getCalendarEvent(date = new Date()) {
  const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
  const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';

  // If no API key, fall back to mock
  if (!apiKey) {
    console.warn('VITE_GOOGLE_CALENDAR_API_KEY not set, using mock calendar data');
    return getMockCalendarEvent();
  }

  try {
    // Format date for Google Calendar API (RFC3339 format)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();

    // Fetch events from Google Calendar API
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=1&orderBy=startTime&singleEvents=true`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        console.warn('Google Calendar API access denied. Make sure the API key has Calendar API enabled.');
      }
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // If no events found, return a default event
    if (!data.items || data.items.length === 0) {
      return {
        title: "No scheduled events",
        formality: "casual",
        startTime: null,
        endTime: null
      };
    }

    const event = data.items[0];
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;

    // Infer formality from event title/description
    const formality = inferFormality(event.summary || '', event.description || '');

    return {
      title: event.summary || "Untitled Event",
      formality: formality,
      startTime: start ? new Date(start).toLocaleTimeString() : null,
      endTime: end ? new Date(end).toLocaleTimeString() : null,
      location: event.location || null,
      description: event.description || null
    };
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    // Fall back to mock on error
    console.warn('Falling back to mock calendar data');
    return getMockCalendarEvent();
  }
}

/**
 * Infer formality level from event title and description
 * @param {string} title - Event title
 * @param {string} description - Event description
 * @returns {string} Formality level: "formal", "business", or "casual"
 */
function inferFormality(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  // Keywords that suggest formality
  const formalKeywords = ['presentation', 'interview', 'wedding', 'formal', 'black tie', 'meeting', 'conference', 'client'];
  const businessKeywords = ['meeting', 'lunch', 'business', 'office', 'work', 'client'];
  
  if (formalKeywords.some(keyword => text.includes(keyword))) {
    return 'formal';
  }
  if (businessKeywords.some(keyword => text.includes(keyword))) {
    return 'business';
  }
  
  return 'casual';
}

/**
 * Mock weather data for development/testing
 * @returns {Promise<Object>} Mock weather object
 */
async function getMockWeather() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { 
    tempF: 55, 
    condition: "Rain",
    // Note: location is undefined for mock data to help detect it
    // Additional fields that could be useful:
    // tempC: 13,
    // humidity: 75,
    // windSpeed: 10,
    // feelsLike: 50
  };
}

/**
 * Mock calendar event for development/testing
 * @returns {Promise<Object>} Mock calendar event object
 */
async function getMockCalendarEvent() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { 
    title: "Client Presentation", 
    formality: "formal",
    // Additional fields that could be useful:
    // startTime: "09:00",
    // endTime: "10:30",
    // location: "Conference Room A",
    // attendees: 5
  };
}

