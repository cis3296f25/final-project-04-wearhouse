import SuggestOutfitButton from "../components/SuggestOutfitButton";

export default function Overview({ items, setMessage, getWeather, getEvent }) {
  return (
    <>
      <SuggestOutfitButton
        items={items}
        getWeather={getWeather}
        getEvent={getEvent}
        onMessage={setMessage}
      />
      <div className="message" aria-live="polite">{/* message rendered by App */}</div>
    </>
  );
}
