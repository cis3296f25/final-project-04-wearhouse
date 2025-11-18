import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getWeather, getCalendarEvent } from "./services/weatherCalendarService";
import { suggestOutfit as generateOutfitSuggestion } from "./services/outfitSuggestionService";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Log environment variables for debugging
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('ANON:', import.meta.env.VITE_SUPABASE_ANON?.slice(0, 10) + '...');
console.log('Weather API Key:', import.meta.env.VITE_WEATHER_API_KEY ? '✅ Set' : '❌ Not set');

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
  
  // Event management state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showFormalityModal, setShowFormalityModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  
  // New event form state
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [newEventFormality, setNewEventFormality] = useState("casual");

  // Load items from Supabase and update grid
  async function loadItems() {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (!error) setItems(data ?? []);
  }

  // Fetch initial items on mount
  useEffect(() => { loadItems(); }, []);

  // Load events from localStorage
  function loadEventsFromStorage() {
    try {
      const stored = localStorage.getItem('wearhouse_events');
      if (stored) {
        const events = JSON.parse(stored);
        // Convert to FullCalendar format
        const calendarEvents = events.map(event => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay || false,
          formality: event.formality || 'casual',
          backgroundColor: getFormalityColor(event.formality || 'casual'),
          borderColor: getFormalityColor(event.formality || 'casual'),
          extendedProps: {
            formality: event.formality || 'casual'
          }
        }));
        setCalendarEvents(calendarEvents);
        return calendarEvents;
      }
    } catch (error) {
      console.error('Error loading events from storage:', error);
    }
    return [];
  }

  // Save events to localStorage
  function saveEventsToStorage(events) {
    try {
      const eventsToSave = events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay || false,
        formality: event.extendedProps?.formality || event.formality || 'casual'
      }));
      localStorage.setItem('wearhouse_events', JSON.stringify(eventsToSave));
    } catch (error) {
      console.error('Error saving events to storage:', error);
    }
  }

  // Get formality color
  function getFormalityColor(formality) {
    const colors = {
      formal: '#8B0000',    // Dark red
      business: '#1E3A8A',  // Dark blue
      casual: '#059669'     // Green
    };
    return colors[formality] || colors.casual;
  }

  // Load calendar events on mount
  useEffect(() => {
    loadEventsFromStorage();
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
      // Fetch weather data
      const weather = await getWeather();
      
      // Find today's event from local calendar events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      // Find events happening today
      const todayEvents = calendarEvents.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart >= today && eventStart <= todayEnd;
      });
      
      // Get the first event today, or use default
      let event = null;
      if (todayEvents.length > 0) {
        const firstEvent = todayEvents[0];
        event = {
          title: firstEvent.title,
          formality: firstEvent.extendedProps?.formality || firstEvent.formality || 'casual',
          startTime: firstEvent.start
        };
      } else {
        // No event today, use default
        event = {
          title: "No scheduled events",
          formality: "casual"
        };
      }

      // Generate outfit suggestion with calendar events for context
      const result = generateOutfitSuggestion({ 
        items, 
        weather, 
        event,
        calendarEvents: calendarEvents 
      });

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

  // Handle adding new event
  function handleAddEvent(e) {
    e.preventDefault();
    
    if (!newEventTitle || !newEventDate) {
      setMessage("❌ Please fill in at least the event title and date");
      return;
    }

    // Create event start datetime
    const startDate = new Date(newEventDate);
    if (newEventStartTime) {
      const [hours, minutes] = newEventStartTime.split(':').map(Number);
      startDate.setHours(hours, minutes || 0, 0, 0);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    // Create event end datetime
    let endDate = new Date(startDate);
    if (newEventEndTime) {
      const [hours, minutes] = newEventEndTime.split(':').map(Number);
      endDate.setHours(hours, minutes || 0, 0, 0);
    } else {
      // Default to 1 hour after start if no end time
      endDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    }

    const newEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      title: newEventTitle,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: !newEventStartTime && !newEventEndTime,
      formality: newEventFormality,
      backgroundColor: getFormalityColor(newEventFormality),
      borderColor: getFormalityColor(newEventFormality),
      extendedProps: {
        formality: newEventFormality
      }
    };

    // Add to calendar events
    const updatedEvents = [...calendarEvents, newEvent];
    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    const eventTitle = newEventTitle; // Save before reset
    
    // Reset form
    setNewEventTitle("");
    setNewEventDate("");
    setNewEventStartTime("");
    setNewEventEndTime("");
    setNewEventFormality("casual");
    setShowAddEventModal(false);
    
    setMessage(`✅ Event "${eventTitle}" added successfully!`);
  }

  // Handle formality update
  function handleUpdateFormality(formality) {
    if (!selectedEvent) {
      return;
    }

    // Update the event in the calendar events array
    const updatedEvents = calendarEvents.map(event => {
      if (event.id === selectedEvent.id) {
        return {
          ...event,
          formality: formality,
          backgroundColor: getFormalityColor(formality),
          borderColor: getFormalityColor(formality),
          extendedProps: {
            ...event.extendedProps,
            formality: formality
          }
        };
      }
      return event;
    });

    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);
    
    setMessage(`✅ Updated formality to ${formality}`);
    setShowFormalityModal(false);
    setSelectedEvent(null);
  }

  // Handle event deletion
  function handleDeleteEvent() {
    if (!selectedEvent) {
      return;
    }

    const updatedEvents = calendarEvents.filter(event => event.id !== selectedEvent.id);
    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);
    
    setMessage(`✅ Event "${selectedEvent.title}" deleted`);
    setShowFormalityModal(false);
    setSelectedEvent(null);
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
      <div style={{ 
        marginBottom: 12, 
        minHeight: 24, 
        whiteSpace: "pre-line", 
        fontFamily: "system-ui, -apple-system, sans-serif", 
        fontSize: "14px",
        lineHeight: "1.6",
        padding: "12px",
        backgroundColor: "transparent"
      }}>
        {message || "Click 'Test Weather API' to verify your API key is working"}
      </div>

      {/* FullCalendar Component */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Calendar & Events</h3>
        <button 
          onClick={() => {
            // Set default date to today
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            setNewEventDate(dateStr);
            setShowAddEventModal(true);
          }}
          style={{ 
            backgroundColor: "#4285F4", 
            color: "white", 
            border: "none",
            padding: "10px 20px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          ➕ Add Event
        </button>
      </div>
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
            
            // Store selected event for formality update
            setSelectedEvent({
              id: event.id,
              title: event.title,
              formality: extendedProps.formality || 'casual'
            });
            
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
              eventDetails += `📝 ${extendedProps.description}\n`;
            }
            
            // Show formality selector
            eventDetails += `\n💡 Click a formality option below to change this event's formality level.`;
            setShowFormalityModal(true);
            
            setMessage(eventDetails);
            info.jsEvent.preventDefault();
          }}
          editable={false}
          selectable={false}
          dayMaxEvents={true}
          moreLinkClick="popover"
        />
      </div>

      {/* Formality Selection Modal */}
      {showFormalityModal && selectedEvent && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 400,
            width: "90%"
          }}>
            <h3 style={{ marginTop: 0 }}>Set Event Formality</h3>
            <p><strong>{selectedEvent.title}</strong></p>
            <p>Current formality: <strong>{selectedEvent.formality}</strong></p>
            <div style={{ display: "flex", gap: 8, flexDirection: "column", marginTop: 16 }}>
              <button
                onClick={() => handleUpdateFormality('casual')}
                style={{
                  backgroundColor: selectedEvent.formality === 'casual' ? '#059669' : '#e5e7eb',
                  color: selectedEvent.formality === 'casual' ? 'white' : 'black',
                  padding: "12px",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                👕 Casual
              </button>
              <button
                onClick={() => handleUpdateFormality('business')}
                style={{
                  backgroundColor: selectedEvent.formality === 'business' ? '#1E3A8A' : '#e5e7eb',
                  color: selectedEvent.formality === 'business' ? 'white' : 'black',
                  padding: "12px",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                👔 Business
              </button>
              <button
                onClick={() => handleUpdateFormality('formal')}
                style={{
                  backgroundColor: selectedEvent.formality === 'formal' ? '#8B0000' : '#e5e7eb',
                  color: selectedEvent.formality === 'formal' ? 'white' : 'black',
                  padding: "12px",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                🎩 Formal
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${selectedEvent.title}"?`)) {
                      handleDeleteEvent();
                    }
                  }}
                  style={{
                    backgroundColor: "#dc3545",
                    color: "white",
                    padding: "12px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    flex: 1
                  }}
                >
                  🗑️ Delete
                </button>
                <button
                  onClick={() => {
                    setShowFormalityModal(false);
                    setSelectedEvent(null);
                  }}
                  style={{
                    backgroundColor: "#6b7280",
                    color: "white",
                    padding: "12px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    flex: 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 500,
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <h3 style={{ marginTop: 0 }}>Add New Event</h3>
            <form onSubmit={handleAddEvent} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "500" }}>
                  Event Title *
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  placeholder="e.g., Client Meeting"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "500" }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd" }}
                />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "500" }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newEventStartTime}
                    onChange={e => setNewEventStartTime(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd" }}
                  />
                  <small style={{ color: "#666" }}>Leave empty for all-day</small>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "500" }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={e => setNewEventEndTime(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd" }}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "500" }}>
                  Formality Level
                </label>
                <select
                  value={newEventFormality}
                  onChange={e => setNewEventFormality(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd" }}
                >
                  <option value="casual">👕 Casual</option>
                  <option value="business">👔 Business</option>
                  <option value="formal">🎩 Formal</option>
                </select>
              </div>
              
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#4285F4",
                    color: "white",
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    flex: 1,
                    fontWeight: "500"
                  }}
                >
                  Add Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEventModal(false);
                    setNewEventTitle("");
                    setNewEventDate("");
                    setNewEventStartTime("");
                    setNewEventEndTime("");
                    setNewEventFormality("casual");
                  }}
                  style={{
                    backgroundColor: "#6b7280",
                    color: "white",
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    flex: 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

