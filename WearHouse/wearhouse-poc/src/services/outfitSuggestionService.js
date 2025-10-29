/**
 * Outfit Suggestion Service
 * Contains logic for generating outfit recommendations based on weather, calendar, and available items
 */

/**
 * Generate an outfit suggestion based on weather, calendar event, and available items
 * @param {Object} params
 * @param {Array} params.items - Array of clothing items from the database
 * @param {Object} params.weather - Weather data from weatherCalendarService
 * @param {Object} params.event - Calendar event from weatherCalendarService
 * @returns {Object} Outfit suggestion with top, bottom, and recommendation details
 */
export function suggestOutfit({ items, weather, event }) {
  const tops = items.filter(i => i.category === "top");
  const bottoms = items.filter(i => i.category === "bottom");

  if (!tops.length || !bottoms.length) {
    return {
      success: false,
      message: "Need at least one top and one bottom to suggest an outfit.",
      outfit: null
    };
  }

  // Determine color preferences based on weather and event
  const preferDark = weather.tempF < 60 || 
                     weather.condition.includes("Rain") || 
                     event.formality === "formal" || 
                     event.formality === "business";
  
  const colorOk = (c) => preferDark 
    ? ["black", "navy", "gray", "brown"].includes(c.toLowerCase()) 
    : true;

  // Choose first matching items or fall back to first available
  const top = tops.find(t => colorOk(t.color)) ?? tops[0];
  const bottom = bottoms.find(b => colorOk(b.color)) ?? bottoms[0];

  // Build recommendation message
  const message = 
    `Weather ${weather.tempF}°F ${weather.condition}; Event: ${event.title} (${event.formality}). ` +
    `Outfit → Top: ${top.name} (${top.color}), Bottom: ${bottom.name} (${bottom.color}).`;

  return {
    success: true,
    message,
    outfit: { top, bottom },
    context: { weather, event }
  };
}

