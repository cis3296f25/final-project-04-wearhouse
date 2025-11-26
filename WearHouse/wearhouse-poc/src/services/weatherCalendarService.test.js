import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getWeather, 
  getCalendarEvent, 
  getCalendarEvents,
  convertToFullCalendarEvent,
  getWeatherForDate
} from './weatherCalendarService';

describe('WeatherCalendarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch globally
    global.fetch = vi.fn();
    // Mock geolocation
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn()
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWeather', () => {
    test('should return mock weather when API key is not set', async () => {
      // Use vi.stubEnv to temporarily remove API key
      vi.stubEnv('VITE_WEATHER_API_KEY', '');

      const weather = await getWeather();

      expect(weather).toBeDefined();
      expect(weather.tempF).toBe(55);
      expect(weather.condition).toBe('Rain');
      expect(weather.location).toBeUndefined(); // Mock data doesn't have location

      vi.unstubAllEnvs();
    });

    test('should fetch real weather when API key is set', async () => {
      vi.stubEnv('VITE_WEATHER_API_KEY', 'test-key');
      
      // Mock successful geolocation
      global.navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });
      });

      // Mock successful API response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          main: {
            temp: 70,
            feels_like: 68,
            humidity: 65
          },
          weather: [{
            main: 'Clear',
            description: 'clear sky'
          }],
          wind: {
            speed: 5
          },
          name: 'New York'
        })
      });

      const weather = await getWeather();

      expect(weather).toBeDefined();
      expect(weather.tempF).toBe(70);
      expect(weather.condition).toBe('Clear');
      expect(weather.location).toBe('New York');
      
      vi.unstubAllEnvs();
    });

    test('should handle geolocation failure and use default location', async () => {
      vi.stubEnv('VITE_WEATHER_API_KEY', 'test-key');
      
      // Mock geolocation failure
      global.navigator.geolocation.getCurrentPosition.mockImplementation((success, error) => {
        error(new Error('Geolocation error'));
      });

      // Mock successful API response with default location
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          main: {
            temp: 55,
            feels_like: 53,
            humidity: 75
          },
          weather: [{
            main: 'Clouds',
            description: 'overcast clouds'
          }],
          wind: {
            speed: 10
          },
          name: 'London'
        })
      });

      const weather = await getWeather();

      expect(weather).toBeDefined();
      expect(weather.location).toBe('London');
      
      vi.unstubAllEnvs();
    });

    test('should handle API errors and fall back to mock', async () => {
      vi.stubEnv('VITE_WEATHER_API_KEY', 'test-key');
      
      global.navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });
      });

      // Mock API error
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const weather = await getWeather();

      // Should fall back to mock
      expect(weather).toBeDefined();
      expect(weather.tempF).toBe(55);
      
      vi.unstubAllEnvs();
    });

    test('should handle 401 error and fall back to mock', async () => {
      vi.stubEnv('VITE_WEATHER_API_KEY', 'invalid-key');
      
      global.navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          message: 'Invalid API key'
        })
      });

      // The function falls back to mock data instead of throwing
      const weather = await getWeather();
      expect(weather).toBeDefined();
      expect(weather.tempF).toBe(55); // Mock data
      
      vi.unstubAllEnvs();
    });
  });

  describe('getCalendarEvent', () => {
    test('should return mock calendar event when API key is not set', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', '');

      const event = await getCalendarEvent();

      expect(event).toBeDefined();
      expect(event.title).toBe('Client Presentation');
      expect(event.formality).toBe('formal');
      
      vi.unstubAllEnvs();
    });

    test('should fetch real calendar event when API key is set', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', 'test-key');
      vi.stubEnv('VITE_GOOGLE_CALENDAR_ID', 'primary');

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{
            id: 'event123',
            summary: 'Team Meeting',
            start: {
              dateTime: '2024-01-15T10:00:00Z'
            },
            end: {
              dateTime: '2024-01-15T11:00:00Z'
            },
            extendedProperties: {
              private: {
                wearhouseFormality: 'business'
              }
            }
          }]
        })
      });

      const event = await getCalendarEvent(new Date('2024-01-15'));

      expect(event).toBeDefined();
      expect(event.title).toBe('Team Meeting');
      expect(event.formality).toBe('business');
      
      vi.unstubAllEnvs();
    });

    test('should return default event when no events found', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', 'test-key');

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: []
        })
      });

      const event = await getCalendarEvent();

      expect(event).toBeDefined();
      expect(event.title).toBe('No scheduled events');
      expect(event.formality).toBe('casual');
      
      vi.unstubAllEnvs();
    });

    test('should infer formality from event title', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', 'test-key');

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{
            id: 'event123',
            summary: 'Wedding Ceremony',
            start: {
              date: '2024-01-15'
            },
            end: {
              date: '2024-01-15'
            }
          }]
        })
      });

      const event = await getCalendarEvent(new Date('2024-01-15'));

      expect(event.formality).toBe('formal');
      
      vi.unstubAllEnvs();
    });
  });

  describe('getCalendarEvents', () => {
    test('should return mock events when API key is not set', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', '');

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const events = await getCalendarEvents(startDate, endDate);

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      vi.unstubAllEnvs();
    });

    test('should fetch real calendar events when API key is set', async () => {
      vi.stubEnv('VITE_GOOGLE_CALENDAR_API_KEY', 'test-key');

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'event1',
              summary: 'Meeting 1',
              start: { dateTime: '2024-01-15T10:00:00Z' },
              end: { dateTime: '2024-01-15T11:00:00Z' }
            },
            {
              id: 'event2',
              summary: 'Meeting 2',
              start: { date: '2024-01-16' },
              end: { date: '2024-01-16' }
            }
          ]
        })
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const events = await getCalendarEvents(startDate, endDate);

      expect(events.length).toBe(2);
      expect(events[0].title).toBe('Meeting 1');
      expect(events[1].allDay).toBe(true);
      
      vi.unstubAllEnvs();
    });
  });

  describe('convertToFullCalendarEvent', () => {
    test('should convert event to FullCalendar format', () => {
      const event = {
        title: 'Test Event',
        formality: 'business',
        startTime: '10:00',
        endTime: '11:00',
        location: 'Office'
      };

      const weather = {
        tempF: 70,
        condition: 'Clear'
      };

      const calendarEvent = convertToFullCalendarEvent(event, weather);

      expect(calendarEvent).toBeDefined();
      expect(calendarEvent.title).toContain('Test Event');
      expect(calendarEvent.title).toContain('70°F');
      expect(calendarEvent.extendedProps.formality).toBe('business');
    });

    test('should work without weather', () => {
      const event = {
        title: 'Test Event',
        formality: 'casual'
      };

      const calendarEvent = convertToFullCalendarEvent(event);

      expect(calendarEvent.title).toBe('Test Event');
      expect(calendarEvent.extendedProps.formality).toBe('casual');
    });
  });

  describe('getWeatherForDate', () => {
    test('should return weather for a specific date', async () => {
      vi.stubEnv('VITE_WEATHER_API_KEY', 'test-key');
      
      global.navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          main: {
            temp: 65,
            feels_like: 63,
            humidity: 60
          },
          weather: [{
            main: 'Clouds',
            description: 'partly cloudy'
          }],
          wind: {
            speed: 8
          },
          name: 'New York'
        })
      });

      const weather = await getWeatherForDate(new Date('2024-01-15'));

      expect(weather).toBeDefined();
      expect(weather.tempF).toBe(65);
      
      vi.unstubAllEnvs();
    });
  });
});

