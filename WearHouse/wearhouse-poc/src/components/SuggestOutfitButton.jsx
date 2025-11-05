import { suggest } from "../utils/outfitRules";

export default function SuggestOutfitButton({ items, getWeather, getEvent, onMessage }) {
  async function run() {
    onMessage("Generating...");
    const weather = await getWeather();
    const event = await getEvent();

    const tops = items.filter(i => i.category === "top");
    const bottoms = items.filter(i => i.category === "bottom");

    if (!tops.length || !bottoms.length) {
      onMessage("Need at least one top and one bottom to suggest an outfit.");
      return;
    }

    const { top, bottom } = suggest(tops, bottoms, weather, event);
    onMessage(
      `Weather ${weather.tempF}°F ${weather.condition}; Event: ${event.title} (${event.formality}). ` +
      `Outfit → Top: ${top.name} (${top.color}), Bottom: ${bottom.name} (${bottom.color}).`
    );
  }

  return <button onClick={run} style={{ marginBottom: 12 }}>
    Suggest Outfit (uses weather + calendar mocks)
  </button>;
}
