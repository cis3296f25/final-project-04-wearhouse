import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getWeather, getCalendarEvent, getCalendarEvents } from "./services/weatherCalendarService";
import { suggestOutfit as generateOutfitSuggestion } from "./services/outfitSuggestionService";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Log environment variables for debugging
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('ANON:', import.meta.env.VITE_SUPABASE_ANON?.slice(0, 10) + '...');
console.log('Weather API Key:', import.meta.env.VITE_WEATHER_API_KEY ? '✅ Set' : '❌ Not set');
console.log('Calendar API Key:', import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY ? '✅ Set' : '❌ Not set');

// Initialize Supabase client with env configuration
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON
);

// Send image to proxy and return background-removed PNG as File
async function removeBackgroundOnServer(file) {
  const fd = new FormData();
  fd.append('file', file);

  const resp = await fetch('http://localhost:3001/remove-bg', {
    method: 'POST',
    body: fd,
  });

  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok || !ct.includes('image/png')) {
    // Throw readable error when remove.bg fails
    const txt = await resp.text();
    throw new Error(`remove-bg failed (${resp.status}): ${txt}`);
  }

  // Produce a new PNG File with transparent background
  const ab = await resp.arrayBuffer();
  const cleanedName = file.name.replace(/\.\w+$/, '') + '-nobg.png';
  return new File([ab], cleanedName, { type: 'image/png' });
}


export default function App() {
  // Manage UI state for items, form inputs, and status messages
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("top");
  const [color, setColor] = useState("black");
  const [message, setMessage] = useState("");
  
  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarView, setCalendarView] = useState("dayGridMonth");

  // Load items from Supabase and update grid
  async function loadItems() {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (!error) setItems(data ?? []);
  }

  // Fetch initial items on mount
  useEffect(() => { loadItems(); }, []);

  // Load calendar events for the current view
  async function loadCalendarEvents(start, end) {
    try {
      const events = await getCalendarEvents(start, end);
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setMessage('Failed to load calendar events. Check console for details.');
    }
  }

  // Load calendar events on mount and when view changes
  useEffect(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    loadCalendarEvents(startOfMonth, endOfMonth);
  }, []);

  // Handle upload: remove background → upload to storage → insert DB row
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
  
    // Remove background via proxy with graceful fallback
    setMessage('Removing background…');
    let processedFile = file;
    try {
      processedFile = await removeBackgroundOnServer(file);
    } catch (err) {
      console.error(err);
      setMessage('Background removal failed, uploading original instead.');
    }
  
    // Upload processed file to Supabase Storage
    setMessage('Uploading to storage…');
    const filename = `${crypto.randomUUID()}-${processedFile.name}`;
    const { data: upload, error: upErr } = await supabase.storage
      .from('items')
      .upload(filename, processedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: processedFile.type || 'image/png',
      });
    if (upErr) { setMessage('Upload failed: ' + upErr.message); return; }
  
    // Persist public URL and metadata in items table
    const { data: pub } = supabase.storage.from('items').getPublicUrl(upload.path);
    const image_url = pub.publicUrl;
  
    const { error: dbErr } = await supabase.from('items').insert({
      name, category, color, image_url
    });
    if (dbErr) { setMessage('DB insert failed: ' + dbErr.message); return; }
  
    // Reset form and refresh list
    setMessage('Added item with background removed!');
    setName(''); setCategory('top'); setColor('black'); setFile(null);
    await loadItems();
  }
  
  // Test weather API independently
  async function testWeather() {
    setMessage("Testing weather API...");
    console.log('Testing weather API...');
    
    try {
      const weather = await getWeather();
      console.log('Weather API Response:', weather);
      
      // Show detailed weather info
      const weatherDetails = [
        `📍 Location: ${weather.location || 'Unknown'}`,
        `🌡️ Temperature: ${weather.tempF}°F (${weather.tempC || 'N/A'}°C)`,
        `🌤️ Condition: ${weather.condition}`,
        weather.description ? `📝 Description: ${weather.description}` : '',
        weather.humidity ? `💧 Humidity: ${weather.humidity}%` : '',
        weather.windSpeed ? `💨 Wind: ${weather.windSpeed} mph` : '',
        weather.feelsLike ? `🔥 Feels like: ${weather.feelsLike}°F` : ''
      ].filter(Boolean).join('\n');
      
      setMessage(`Weather API Test Success!\n${weatherDetails}`);
      
      // Check if using mock or real API
      const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
      if (!apiKey || weather.location === undefined) {
        console.warn('⚠️ Using MOCK data - API key not found in environment');
        setMessage(prev => prev + '\n⚠️ Using MOCK data - Add VITE_WEATHER_API_KEY to .env file\n💡 Remember to restart the dev server after adding .env variables!');
      } else {
        console.log('✅ Using REAL API - Weather data fetched successfully');
      }
    } catch (error) {
      console.error("Weather API test failed:", error);
      // Show detailed error message, especially for 401 errors
      const errorMsg = error.message.includes('401') 
        ? `❌ API Key Authentication Failed!\n\n${error.message}\n\n` +
          `💡 Troubleshooting:\n` +
          `• Double-check your API key in the .env file\n` +
          `• Make sure there are no extra spaces or quotes\n` +
          `• New API keys may take a few minutes to activate\n` +
          `• Verify your key at https://home.openweathermap.org/api_keys`
        : `Weather API Test Failed: ${error.message}\nCheck console for details.`;
      setMessage(errorMsg);
    }
  }

  // Generate outfit suggestion using weather and calendar services
  async function suggestOutfit() {
    setMessage("Generating...");
    
    try {
      // Fetch weather and calendar data
      const weather = await getWeather();
      const event = await getCalendarEvent();

      // Generate outfit suggestion
      const result = generateOutfitSuggestion({ items, weather, event });

      if (result.success) {
        setMessage(result.message);
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      console.error("Error generating outfit suggestion:", error);
      setMessage("Failed to generate outfit suggestion. Please try again.");
    }
  }

  return (
    // Render main container and typography
    <div style={{ padding: 24, fontFamily: "Inter, system-ui, Arial" }}>
      <h1>• WearHouse POC •</h1>

      {/* Render upload form and inputs */}
      <form onSubmit={handleUpload} style={{ marginBottom: 16, display: "grid", gap: 8, maxWidth: 420 }}>
        <input placeholder="Item name (e.g., Blue Oxford)" value={name} onChange={e=>setName(e.target.value)} required />
        <select value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="top">top</option>
          <option value="bottom">bottom</option>
          <option value="outerwear">outerwear</option>
          <option value="shoes">shoes</option>
          <option value="accessory">accessory</option>
        </select>
        <input placeholder="Color (e.g., navy)" value={color} onChange={e=>setColor(e.target.value)} />
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0] ?? null)} required />
        <button type="submit">Add Item</button>
      </form>

      {/* Weather API Testing */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={testWeather} style={{ backgroundColor: "#4CAF50", color: "white" }}>
          Test Weather API
        </button>
        <button onClick={suggestOutfit}>Suggest Outfit</button>
      </div>
      <div style={{ marginBottom: 12, minHeight: 24, whiteSpace: "pre-line", fontFamily: "monospace", fontSize: "14px" }}>
        {message || "Click 'Test Weather API' to verify your API key is working"}
      </div>

      {/* FullCalendar Component */}
      <h3>Calendar & Events</h3>
      <div style={{ marginBottom: 24 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          events={calendarEvents}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          height="auto"
          eventClick={(info) => {
            const event = info.event;
            const extendedProps = event.extendedProps || {};
            const weather = extendedProps.weather;
            
            let eventDetails = `📅 ${event.title}\n`;
            if (extendedProps.formality) {
              eventDetails += `👔 Formality: ${extendedProps.formality}\n`;
            }
            if (extendedProps.location) {
              eventDetails += `📍 Location: ${extendedProps.location}\n`;
            }
            if (weather) {
              eventDetails += `🌤️ Weather: ${weather.tempF}°F ${weather.condition}\n`;
            }
            if (extendedProps.description) {
              eventDetails += `📝 ${extendedProps.description}`;
            }
            
            setMessage(eventDetails);
            info.jsEvent.preventDefault();
          }}
          datesSet={(dateInfo) => {
            // Load events when calendar view changes
            loadCalendarEvents(dateInfo.start, dateInfo.end);
          }}
          editable={false}
          selectable={false}
          dayMaxEvents={true}
          moreLinkClick="popover"
        />
      </div>

      {/* Render items grid from database */}
      <h3>Your Items</h3>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {items.map(it => (
          <div key={it.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
            {/* Display stored image with background removed */}
            <img src={it.image_url} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6 }} />
            <div style={{ fontWeight: 600, marginTop: 6 }}>{it.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{it.category} • {it.color}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
