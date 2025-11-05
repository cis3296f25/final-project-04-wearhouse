export default function ItemsGrid({ items = [] }) {
  return (
    <section className="items-wrap">
      <h3>Your Items</h3>
      <div className="grid">
        {items.map(it => (
          <article key={it.id} className="card">
            <img src={it.image_url} alt={it.name} />
            <div className="title">{it.name}</div>
            <div className="meta">{it.category} • {it.color}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
