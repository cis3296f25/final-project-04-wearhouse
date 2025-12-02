export default function ItemCard({ imageUrl, name, category, color }) {
  return (
    <div className="item-card">
      <img
        src={imageUrl}
        alt={name}
        className="item-image"
      />
      <div className="item-name">{name}</div>
      <div className="item-meta">
        {category} • {color}
      </div>
    </div>
  );
}
