import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { removeBackgroundOnServer } from "../services/removeBg";
import { useAuth } from "../contexts/AuthContext";

export default function UploadForm({ onAdded, onMessage }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("top");
  const [color, setColor] = useState("black");

  async function handleUpload(e) {
    e.preventDefault();
    if (!user) return onMessage("Please log in first.");
    if (!file) return;

    onMessage("Removing background…");
    let processedFile = file;
    try {
      processedFile = await removeBackgroundOnServer(file);
    } catch (err) {
      console.error(err);
      onMessage("Background removal failed, uploading original instead.");
    }

    onMessage("Uploading to storage…");
    const filename = `${crypto.randomUUID()}-${processedFile.name}`;
    const { data: upload, error: upErr } = await supabase.storage
      .from("items")
      .upload(filename, processedFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: processedFile.type || "image/png",
      });
    if (upErr) { onMessage("Upload failed: " + upErr.message); return; }

    const { data: pub } = supabase.storage.from("items").getPublicUrl(upload.path);
    const image_url = pub.publicUrl;

    const { error: dbErr } = await supabase.from("items").insert({
      name, category, color, image_url, user_id: user.id
    });
    if (dbErr) { onMessage("DB insert failed: " + dbErr.message); return; }

    onMessage("Added item!");
    setName(""); setCategory("top"); setColor("black"); setFile(null);
    await onAdded?.();
  }

  return (
    <form className="form" onSubmit={handleUpload}>
      <input placeholder="Item name (e.g. Blue Oxford)" value={name} onChange={e=>setName(e.target.value)} required />
      <select value={category} onChange={e=>setCategory(e.target.value)}>
        <option value="top">top</option>
        <option value="bottom">bottom</option>
        <option value="outerwear">outerwear</option>
        <option value="shoes">shoes</option>
        <option value="accessory">accessory</option>
      </select>
      <input placeholder="Color (e.g. navy)" value={color} onChange={e=>setColor(e.target.value)} />
      <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0] ?? null)} required />
      <button type="submit" className="btn">Add Item</button>
    </form>
  );
}
