/**
 * Outfit Suggestion Service
 * Contains logic for generating outfit recommendations based on weather, calendar, and available items
 * Uses rule-based system with weather, formality, and randomness components
 */

/**
 * Get a random element from an array
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get multiple random elements from an array (without duplicates)
 */
function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Score an item based on weather conditions
 */
function scoreItemForWeather(item, weather) {
  let score = 0;
  const tempF = weather.tempF;
  const condition = (weather.condition || '').toLowerCase();
  const color = (item.color || '').toLowerCase();

  // Temperature-based scoring
  if (tempF < 40) {
    // Very cold - prefer outerwear, darker colors
    if (item.category === 'outerwear') score += 10;
    if (['black', 'navy', 'gray', 'brown', 'dark'].some(c => color.includes(c))) score += 3;
  } else if (tempF < 60) {
    // Cool - prefer layers, neutral colors
    if (item.category === 'outerwear') score += 5;
    if (['black', 'navy', 'gray', 'brown', 'beige'].some(c => color.includes(c))) score += 2;
  } else if (tempF < 80) {
    // Moderate - balanced
    score += 1;
  } else {
    // Hot - prefer lighter colors, avoid outerwear
    if (item.category === 'outerwear') score -= 5;
    if (['white', 'light', 'beige', 'tan', 'cream'].some(c => color.includes(c))) score += 3;
    if (['black', 'navy', 'dark'].some(c => color.includes(c))) score -= 2;
  }

  // Weather condition-based scoring
  if (condition.includes('rain') || condition.includes('storm')) {
    // Rainy - prefer darker colors, outerwear
    if (item.category === 'outerwear') score += 5;
    if (['black', 'navy', 'gray', 'dark'].some(c => color.includes(c))) score += 2;
    if (['white', 'light'].some(c => color.includes(c))) score -= 3;
  } else if (condition.includes('snow')) {
    // Snowy - prefer outerwear, warm colors
    if (item.category === 'outerwear') score += 8;
    if (['black', 'navy', 'gray', 'brown'].some(c => color.includes(c))) score += 2;
  } else if (condition.includes('sun') || condition.includes('clear')) {
    // Sunny - can use lighter colors
    if (['white', 'light', 'beige'].some(c => color.includes(c))) score += 2;
  }

  return score;
}

/**
 * Score an item based on formality level
 */
function scoreItemForFormality(item, formality) {
  let score = 0;
  const category = item.category;
  const color = (item.color || '').toLowerCase();
  const name = (item.name || '').toLowerCase();

  if (formality === 'formal') {
    // Formal events - prefer dressy items, dark/neutral colors
    if (category === 'top') {
      if (name.includes('shirt') || name.includes('blouse') || name.includes('dress')) score += 5;
      if (name.includes('t-shirt') || name.includes('hoodie') || name.includes('sweatshirt')) score -= 5;
    }
    if (category === 'bottom') {
      if (name.includes('pant') || name.includes('trouser') || name.includes('skirt')) score += 5;
      if (name.includes('jean') || name.includes('short')) score -= 5;
    }
    if (['black', 'navy', 'gray', 'white'].some(c => color.includes(c))) score += 3;
    if (['bright', 'neon', 'colorful'].some(c => color.includes(c))) score -= 3;
  } else if (formality === 'business') {
    // Business casual - professional but not overly formal
    if (category === 'top') {
      if (name.includes('shirt') || name.includes('blouse') || name.includes('polo')) score += 4;
      if (name.includes('t-shirt') || name.includes('hoodie')) score -= 3;
    }
    if (category === 'bottom') {
      if (name.includes('pant') || name.includes('trouser')) score += 4;
      if (name.includes('jean') || name.includes('short')) score -= 2;
    }
    if (['black', 'navy', 'gray', 'brown', 'beige'].some(c => color.includes(c))) score += 2;
  } else {
    // Casual - more flexibility
    score += 1; // All items get a base score for casual
  }

  return score;
}

/**
 * Check if two items have compatible colors
 */
function areColorsCompatible(color1, color2) {
  const c1 = (color1 || '').toLowerCase();
  const c2 = (color2 || '').toLowerCase();

  // Neutral colors go with everything
  const neutrals = ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'tan', 'brown'];
  if (neutrals.some(n => c1.includes(n)) || neutrals.some(n => c2.includes(n))) {
    return true;
  }

  // Same color family
  if (c1 === c2) return true;

  // Complementary pairs (simplified)
  const complementary = [
    ['blue', 'orange'],
    ['red', 'green'],
    ['yellow', 'purple']
  ];

  for (const pair of complementary) {
    if ((pair[0].includes(c1) && pair[1].includes(c2)) || 
        (pair[1].includes(c1) && pair[0].includes(c2))) {
      return true;
    }
  }

  // Similar tones
  const warm = ['red', 'orange', 'yellow', 'pink', 'coral'];
  const cool = ['blue', 'green', 'purple', 'teal'];
  
  const bothWarm = warm.some(w => c1.includes(w)) && warm.some(w => c2.includes(w));
  const bothCool = cool.some(c => c1.includes(c)) && cool.some(c => c2.includes(c));
  
  return bothWarm || bothCool;
}

/**
 * Generate an outfit suggestion based on weather, calendar event, and available items
 * @param {Object} params
 * @param {Array} params.items - Array of clothing items from the database
 * @param {Object} params.weather - Weather data from weatherCalendarService
 * @param {Object} params.event - Calendar event from weatherCalendarService
 * @param {Array} params.calendarEvents - Array of all calendar events (optional)
 * @returns {Object} Outfit suggestion with top, bottom, outerwear, shoes, and recommendation details
 */
export function suggestOutfit({ items, weather, event, calendarEvents = [] }) {
  const tops = items.filter(i => i.category === "top");
  const bottoms = items.filter(i => i.category === "bottom");
  const outerwear = items.filter(i => i.category === "outerwear");
  const shoes = items.filter(i => i.category === "shoes");
  const accessories = items.filter(i => i.category === "accessory");

  if (!tops.length || !bottoms.length) {
    return {
      success: false,
      message: "Need at least one top and one bottom to suggest an outfit.",
      outfit: null
    };
  }

  // Determine formality from event (default to casual if no event)
  const formality = event?.formality || 'casual';
  const eventTitle = event?.title || 'No scheduled events';

  // Apply randomness factor (0-1, where 1 = completely random, 0 = purely rule-based)
  const randomnessFactor = 0.3; // 30% randomness

  // Score all tops
  const scoredTops = tops.map(top => ({
    item: top,
    weatherScore: scoreItemForWeather(top, weather),
    formalityScore: scoreItemForFormality(top, formality),
    randomScore: Math.random()
  })).map(top => ({
    ...top,
    totalScore: (top.weatherScore * 0.4) + (top.formalityScore * 0.4) + (top.randomScore * randomnessFactor * 10)
  }));

  // Score all bottoms
  const scoredBottoms = bottoms.map(bottom => ({
    item: bottom,
    weatherScore: scoreItemForWeather(bottom, weather),
    formalityScore: scoreItemForFormality(bottom, formality),
    randomScore: Math.random()
  })).map(bottom => ({
    ...bottom,
    totalScore: (bottom.weatherScore * 0.4) + (bottom.formalityScore * 0.4) + (bottom.randomScore * randomnessFactor * 10)
  }));

  // Sort by score
  scoredTops.sort((a, b) => b.totalScore - a.totalScore);
  scoredBottoms.sort((a, b) => b.totalScore - a.totalScore);

  // Get top candidates (top 3)
  const topCandidates = scoredTops.slice(0, Math.min(3, scoredTops.length));
  const bottomCandidates = scoredBottoms.slice(0, Math.min(3, scoredBottoms.length));

  // Apply color compatibility check with randomness
  let selectedTop, selectedBottom;
  
  if (Math.random() < (1 - randomnessFactor)) {
    // Try to find compatible colors
    for (const topCandidate of topCandidates) {
      for (const bottomCandidate of bottomCandidates) {
        if (areColorsCompatible(topCandidate.item.color, bottomCandidate.item.color)) {
          selectedTop = topCandidate.item;
          selectedBottom = bottomCandidate.item;
          break;
        }
      }
      if (selectedTop) break;
    }
  }

  // Fallback to top-scored items if no compatible match found
  if (!selectedTop) selectedTop = topCandidates[0].item;
  if (!selectedBottom) selectedBottom = bottomCandidates[0].item;

  // Select outerwear based on weather
  let selectedOuterwear = null;
  if (outerwear.length > 0) {
    const scoredOuterwear = outerwear.map(ow => ({
      item: ow,
      weatherScore: scoreItemForWeather(ow, weather),
      randomScore: Math.random()
    })).map(ow => ({
      ...ow,
      totalScore: (ow.weatherScore * 0.7) + (ow.randomScore * randomnessFactor * 10)
    }));

    scoredOuterwear.sort((a, b) => b.totalScore - a.totalScore);
    const topOuterwear = scoredOuterwear[0];
    
    // Only suggest outerwear if weather score is positive or temperature is low
    if (topOuterwear.weatherScore > 0 || weather.tempF < 65) {
      selectedOuterwear = topOuterwear.item;
    }
  }

  // Select shoes (random with slight formality preference)
  let selectedShoes = null;
  if (shoes.length > 0) {
    const scoredShoes = shoes.map(shoe => ({
      item: shoe,
      formalityScore: scoreItemForFormality(shoe, formality),
      randomScore: Math.random()
    })).map(shoe => ({
      ...shoe,
      totalScore: (shoe.formalityScore * 0.5) + (shoe.randomScore * randomnessFactor * 10)
    }));

    scoredShoes.sort((a, b) => b.totalScore - a.totalScore);
    selectedShoes = scoredShoes[0].item;
  }

  // Select accessory (random)
  let selectedAccessory = null;
  if (accessories.length > 0 && Math.random() > 0.5) {
    selectedAccessory = getRandomElement(accessories);
  }

  // Build recommendation message
  let message = `🌤️ Weather: ${weather.tempF}°F ${weather.condition}`;
  if (weather.location) message += ` in ${weather.location}`;
  message += `\n📅 Event: ${eventTitle} (${formality})`;
  message += `\n\n✨ Suggested Outfit:\n`;
  message += `👕 Top: ${selectedTop.name} (${selectedTop.color})`;
  message += `\n👖 Bottom: ${selectedBottom.name} (${selectedBottom.color})`;
  if (selectedOuterwear) {
    message += `\n🧥 Outerwear: ${selectedOuterwear.name} (${selectedOuterwear.color})`;
  }
  if (selectedShoes) {
    message += `\n👟 Shoes: ${selectedShoes.name} (${selectedShoes.color})`;
  }
  if (selectedAccessory) {
    message += `\n💍 Accessory: ${selectedAccessory.name} (${selectedAccessory.color})`;
  }

  // Add reasoning
  message += `\n\n💡 Why this outfit?`;
  if (weather.tempF < 60) {
    message += ` It's cool outside, so `;
    if (selectedOuterwear) message += `layers are recommended.`;
    else message += `consider adding a layer.`;
  } else if (weather.tempF > 80) {
    message += ` It's warm, so lighter colors and breathable fabrics work best.`;
  } else {
    message += ` The temperature is comfortable for this outfit.`;
  }
  
  if (formality === 'formal') {
    message += ` The ${formality} event calls for polished, professional pieces.`;
  } else if (formality === 'business') {
    message += ` The ${formality} setting requires a professional yet approachable look.`;
  }

  return {
    success: true,
    message,
    outfit: { 
      top: selectedTop, 
      bottom: selectedBottom,
      outerwear: selectedOuterwear,
      shoes: selectedShoes,
      accessory: selectedAccessory
    },
    context: { weather, event, formality }
  };
}

