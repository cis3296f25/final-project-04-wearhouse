export default function UploadForm({
  name,
  category,
  color,
  setName,
  setCategory,
  setColor,
  setFile,
  onSubmit,

}) {
  return (
    <form onSubmit={onSubmit} className="app-form">
      <input
        placeholder="Item name (e.g., Blue Oxford)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="top">top</option>
        <option value="bottom">bottom</option>
        <option value="outerwear">outerwear</option>
        <option value="shoes">shoes</option>
        <option value="accessory">accessory</option>
      </select>

      <input
        placeholder="Color (e.g., navy)"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        required
      />

      {/* Add Item button */}
        <div className="button-row">
        <button type="submit" className="btn-action">
            Add Item
        </button>
        </div>

    </form>
  );
}
