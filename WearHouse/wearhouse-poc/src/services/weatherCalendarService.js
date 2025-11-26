/**
 * Weather and Calendar Integration Service
 * Handles fetching weather data and calendar events for outfit suggestions
 * 
 * Environment Variables Required:
 * - VITE_WEATHER_API_KEY: OpenWeatherMap API key (get free at https://openweathermap.org/api)
 * - VITE_GOOGLE_CALENDAR_API_KEY: Google Calendar API key (optional, for public calendar access)
 * - VITE_GOOGLE_CLIENT_ID: Google OAuth Client ID (required for private calendar access)
 * - VITE_GOOGLE_CALENDAR_ID: Your Google Calendar ID (optional, defaults to 'primary')
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
 * @param {string} accessToken - OAuth access token (optional, for authenticated requests)
 * @returns {Promise<Object>} Calendar event with title and formality
 */
export async function getCalendarEvent(date = new Date(), accessToken = null) {
  const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
  const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';

  // If no API key and no access token, fall back to mock
  if (!apiKey && !accessToken) {
    console.warn('No Google Calendar credentials set, using mock calendar data');
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

    // Build URL and headers
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}&maxResults=1&orderBy=startTime&singleEvents=true`;
    
    if (accessToken) {
      url += `&access_token=${accessToken}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    }

    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        console.warn('Google Calendar API access denied. Make sure the API key has Calendar API enabled or use OAuth.');
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

    // Get formality from extendedProperties (if set) or infer from title/description
    const storedFormality = event.extendedProperties?.private?.wearhouseFormality;
    const formality = storedFormality || inferFormality(event.summary || '', event.description || '');

    return {
      id: event.id,
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
 * Get multiple calendar events for a date range (for FullCalendar)
 * @param {Date} startDate - Start date of the range
 * @param {Date} endDate - End date of the range
 * @param {string} accessToken - OAuth access token (optional, for authenticated requests)
 * @returns {Promise<Array>} Array of calendar events in FullCalendar format
 */
export async function getCalendarEvents(startDate, endDate, accessToken = null) {
  const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
  const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';

  // If no API key and no access token, fall back to mock
  if (!apiKey && !accessToken) {
    console.warn('No Google Calendar credentials set, using mock calendar data');
    return getMockCalendarEvents(startDate, endDate);
  }

  try {
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    // Build URL and headers
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&orderBy=startTime&singleEvents=true`;
    
    if (accessToken) {
      url += `&access_token=${accessToken}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    }

    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        console.warn('Google Calendar API access denied. Make sure the API key has Calendar API enabled or use OAuth.');
      }
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Convert Google Calendar events to FullCalendar format
    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map(event => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      
      // Get formality from extendedProperties (if set) or infer from title/description
      const storedFormality = event.extendedProperties?.private?.wearhouseFormality;
      const formality = storedFormality || inferFormality(event.summary || '', event.description || '');

      return {
        id: event.id,
        title: event.summary || "Untitled Event",
        start: start || new Date(),
        end: end || null,
        allDay: !event.start?.dateTime, // All-day if no dateTime
        formality: formality,
        location: event.location || null,
        description: event.description || null,
        backgroundColor: getFormalityColor(formality),
        borderColor: getFormalityColor(formality),
        extendedProps: {
          formality: formality,
          location: event.location,
          description: event.description
        }
      };
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    // Fall back to mock on error
    console.warn('Falling back to mock calendar data');
    return getMockCalendarEvents(startDate, endDate);
  }
}

/**
 * Get weather for a specific date (for forecast integration with calendar)
 * @param {Date} date - Date to get weather for
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Weather data
 */
export async function getWeatherForDate(date, options = {}) {
  // For now, we'll use current weather (OpenWeatherMap free tier doesn't include historical)
  // In production, you'd use a forecast API or historical weather API
  return getWeather(options);
}

/**
 * Convert calendar event to FullCalendar format with weather integration
 * @param {Object} event - Calendar event from getCalendarEvent
 * @param {Object} weather - Weather data (optional)
 * @returns {Object} FullCalendar event object
 */
export function convertToFullCalendarEvent(event, weather = null) {
  const today = new Date();
  const eventDate = new Date(today);
  
  // If event has startTime, parse it; otherwise use current time
  if (event.startTime) {
    const [hours, minutes] = event.startTime.split(':').map(Number);
    eventDate.setHours(hours, minutes || 0, 0, 0);
  }

  const endDate = new Date(eventDate);
  if (event.endTime) {
    const [hours, minutes] = event.endTime.split(':').map(Number);
    endDate.setHours(hours, minutes || 0, 0, 0);
  } else {
    endDate.setHours(eventDate.getHours() + 1, 0, 0, 0); // Default 1 hour duration
  }

  const title = weather 
    ? `${event.title} (${weather.tempF}°F ${weather.condition})`
    : event.title;

  return {
    id: `event-${Date.now()}-${Math.random()}`,
    title: title,
    start: eventDate.toISOString(),
    end: endDate.toISOString(),
    allDay: !event.startTime,
    backgroundColor: getFormalityColor(event.formality),
    borderColor: getFormalityColor(event.formality),
    extendedProps: {
      formality: event.formality,
      location: event.location,
      description: event.description,
      weather: weather
    }
  };
}

/**
 * Get color based on formality level
 * @param {string} formality - Formality level
 * @returns {string} Hex color code
 */
function getFormalityColor(formality) {
  const colors = {
    formal: '#8B0000',    // Dark red
    business: '#1E3A8A',  // Dark blue
    casual: '#059669'     // Green
  };
  return colors[formality] || colors.casual;
}

/**
 * Update event formality in Google Calendar
 * @param {string} eventId - Google Calendar event ID
 * @param {string} formality - Formality level ('formal', 'business', or 'casual')
 * @param {string} accessToken - OAuth access token (required)
 * @param {string} calendarId - Calendar ID (optional, defaults to 'primary')
 * @returns {Promise<Object>} Updated event
 */
export async function updateEventFormality(eventId, formality, accessToken, calendarId = 'primary') {
  if (!accessToken) {
    throw new Error('Access token required to update event formality');
  }

  if (!['formal', 'business', 'casual'].includes(formality)) {
    throw new Error('Formality must be "formal", "business", or "casual"');
  }

  try {
    // First, get the current event
    const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch event: ${getResponse.status} ${getResponse.statusText}`);
    }

    const event = await getResponse.json();

    // Update extendedProperties to store formality
    if (!event.extendedProperties) {
      event.extendedProperties = {};
    }
    if (!event.extendedProperties.private) {
      event.extendedProperties.private = {};
    }
    event.extendedProperties.private.wearhouseFormality = formality;

    // Update the event
    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      throw new Error(`Failed to update event: ${updateResponse.status} ${updateResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const updatedEvent = await updateResponse.json();
    
    // Return in our format
    const start = updatedEvent.start?.dateTime || updatedEvent.start?.date;
    const end = updatedEvent.end?.dateTime || updatedEvent.end?.date;
    const storedFormality = updatedEvent.extendedProperties?.private?.wearhouseFormality || formality;

    return {
      id: updatedEvent.id,
      title: updatedEvent.summary || "Untitled Event",
      formality: storedFormality,
      startTime: start ? new Date(start).toLocaleTimeString() : null,
      endTime: end ? new Date(end).toLocaleTimeString() : null,
      location: updatedEvent.location || null,
      description: updatedEvent.description || null
    };
  } catch (error) {
    console.error('Error updating event formality:', error);
    throw error;
  }
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
    startTime: "09:00",
    endTime: "10:30",
    location: "Conference Room A"
  };
}

/**
 * Mock multiple calendar events for development/testing
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of mock calendar events in FullCalendar format
 */
async function getMockCalendarEvents(startDate, endDate) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const events = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Generate a few mock events
  const mockEvents = [
    { title: "Client Presentation", formality: "formal", hour: 9, duration: 1.5 },
    { title: "Team Lunch", formality: "business", hour: 12, duration: 1 },
    { title: "Gym Session", formality: "casual", hour: 18, duration: 1 }
  ];

  mockEvents.forEach((mock, index) => {
    const eventDate = new Date(today);
    eventDate.setDate(today.getDate() + index);
    eventDate.setHours(mock.hour, 0, 0, 0);
    
    const endDate = new Date(eventDate);
    endDate.setHours(eventDate.getHours() + mock.duration, 0, 0, 0);

    events.push({
      id: `mock-event-${index}`,
      title: mock.title,
      start: eventDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      backgroundColor: getFormalityColor(mock.formality),
      borderColor: getFormalityColor(mock.formality),
      extendedProps: {
        formality: mock.formality,
        location: null,
        description: null
      }
    });
  });

  return events;
}

