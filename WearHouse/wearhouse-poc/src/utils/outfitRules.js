export function suggest(tops, bottoms, weather, event) {
  const preferDark =
    weather.tempF < 60 ||
    weather.condition.includes("Rain") ||
    event.formality === "formal";

  const colorOk = (c) =>
    preferDark ? ["black", "navy", "gray", "brown"].includes(c.toLowerCase()) : true;

  const top = tops.find(t => colorOk(t.color)) ?? tops[0];
  const bottom = bottoms.find(b => colorOk(b.color)) ?? bottoms[0];
  return { top, bottom, preferDark };
}
