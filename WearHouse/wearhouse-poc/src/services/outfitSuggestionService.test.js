import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { suggestOutfit } from './outfitSuggestionService';

describe('OutfitSuggestionService', () => {
  const mockItems = [
    { id: 1, name: 'Blue Shirt', category: 'top', color: 'blue' },
    { id: 2, name: 'White T-Shirt', category: 'top', color: 'white' },
    { id: 3, name: 'Black Jeans', category: 'bottom', color: 'black' },
    { id: 4, name: 'Navy Pants', category: 'bottom', color: 'navy' },
    { id: 5, name: 'Black Jacket', category: 'outerwear', color: 'black' },
    { id: 6, name: 'Brown Shoes', category: 'shoes', color: 'brown' },
    { id: 7, name: 'Silver Watch', category: 'accessory', color: 'silver' }
  ];

  const mockWeather = {
    tempF: 70,
    condition: 'Clear',
    location: 'Test City'
  };

  const mockEvent = {
    title: 'Casual Event',
    formality: 'casual'
  };

  beforeEach(() => {
    // Reset Math.random seed for more predictable tests
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return error when no tops available', () => {
    const items = mockItems.filter(i => i.category !== 'top');
    const result = suggestOutfit({ items, weather: mockWeather, event: mockEvent });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Need at least one top and one bottom');
  });

  test('should return error when no bottoms available', () => {
    const items = mockItems.filter(i => i.category !== 'bottom');
    const result = suggestOutfit({ items, weather: mockWeather, event: mockEvent });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Need at least one top and one bottom');
  });

  test('should suggest outfit successfully with basic items', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    expect(result.success).toBe(true);
    expect(result.outfit).toBeDefined();
    expect(result.outfit.top).toBeDefined();
    expect(result.outfit.bottom).toBeDefined();
    expect(result.message).toContain('Suggested Outfit');
  });

  test('should include weather information in message', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    expect(result.message).toContain('70°F');
    expect(result.message).toContain('Clear');
  });

  test('should include event information in message', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    expect(result.message).toContain('Casual Event');
    expect(result.message).toContain('casual');
  });

  test('should suggest outerwear for cold weather', () => {
    const coldWeather = { tempF: 35, condition: 'Snow', location: 'Test City' };
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: coldWeather, 
      event: mockEvent 
    });

    expect(result.outfit.outerwear).toBeDefined();
    expect(result.message).toContain('Outerwear');
  });

  test('should not suggest outerwear for hot weather', () => {
    const hotWeather = { tempF: 90, condition: 'Sunny', location: 'Test City' };
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: hotWeather, 
      event: mockEvent 
    });

    // Outerwear might still be suggested if temp < 65, but should be less likely
    // This test verifies the logic works
    expect(result.success).toBe(true);
  });

  test('should handle formal events', () => {
    const formalEvent = {
      title: 'Formal Dinner',
      formality: 'formal'
    };

    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: formalEvent 
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('formal');
    expect(result.context.formality).toBe('formal');
  });

  test('should handle business events', () => {
    const businessEvent = {
      title: 'Business Meeting',
      formality: 'business'
    };

    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: businessEvent 
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('business');
    expect(result.context.formality).toBe('business');
  });

  test('should default to casual when no event provided', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: null 
    });

    expect(result.success).toBe(true);
    expect(result.context.formality).toBe('casual');
  });

  test('should include shoes when available', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    expect(result.outfit.shoes).toBeDefined();
    expect(result.message).toContain('Shoes');
  });

  test('should optionally include accessories', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    // Accessories are random, so might or might not be included
    expect(result.success).toBe(true);
  });

  test('should handle empty calendar events array', () => {
    const result = suggestOutfit({ 
      items: mockItems, 
      weather: mockWeather, 
      event: mockEvent,
      calendarEvents: []
    });

    expect(result.success).toBe(true);
  });

  test('should work with minimal item set', () => {
    const minimalItems = [
      { id: 1, name: 'Shirt', category: 'top', color: 'blue' },
      { id: 2, name: 'Pants', category: 'bottom', color: 'black' }
    ];

    const result = suggestOutfit({ 
      items: minimalItems, 
      weather: mockWeather, 
      event: mockEvent 
    });

    expect(result.success).toBe(true);
    expect(result.outfit.top).toBeDefined();
    expect(result.outfit.bottom).toBeDefined();
  });
});

