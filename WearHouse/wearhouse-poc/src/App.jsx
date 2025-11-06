import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Log environment variables for debugging
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('ANON:', import.meta.env.VITE_SUPABASE_ANON?.slice(0, 10) + '...');
console.log(import.meta.env)

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

// Provide mock weather data to exercise outfit rules
async function getMockWeather() {
  return { tempF: 55, condition: "Rain" };
}

// Provide mock calendar event to exercise outfit rules
async function getMockCalendarEvent() {
  return { title: "Client Presentation", formality: "formal" };
}

export default function App() {
  // Manage UI state for items, form inputs, and status messages
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("top");
  const [color, setColor] = useState("black");
  const [message, setMessage] = useState("");

  // Load items from Supabase and update grid
  async function loadItems() {
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (!error) setItems(data ?? []);
  }

  // Fetch initial items on mount
  useEffect(() => { loadItems(); }, []);

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
  
  // Generate a simple outfit using mock weather/calendar and color rules
  async function suggestOutfit() {
    setMessage("Generating...");
    const weather = await getMockWeather();
    const event = await getMockCalendarEvent();

    const tops = items.filter(i => i.category === "top");
    const bottoms = items.filter(i => i.category === "bottom");

    if (!tops.length || !bottoms.length) {
      setMessage("Need at least one top and one bottom to suggest an outfit.");
      return;
    }

    // Prefer darker palette when cold/rainy/formal
    const preferDark = weather.tempF < 60 || weather.condition.includes("Rain") || event.formality === "formal";
    const colorOk = (c) => preferDark ? ["black","navy","gray","brown"].includes(c.toLowerCase()) : true;

    // Choose first matching items or fall back to first available
    const top = tops.find(t => colorOk(t.color)) ?? tops[0];
    const bottom = bottoms.find(b => colorOk(b.color)) ?? bottoms[0];

    // Present recommendation summary in status line
    setMessage(
      `Weather ${weather.tempF}°F ${weather.condition}; Event: ${event.title} (${event.formality}). ` +
      `Outfit → Top: ${top.name} (${top.color}), Bottom: ${bottom.name} (${bottom.color}).`
    );
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

      {/* Trigger outfit suggestion using mock signals */}
      <button onClick={suggestOutfit} style={{ marginBottom: 12 }}>Suggest Outfit (uses weather + calendar mocks)</button>
      <div style={{ marginBottom: 12, minHeight: 24 }}>{message}</div>

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
