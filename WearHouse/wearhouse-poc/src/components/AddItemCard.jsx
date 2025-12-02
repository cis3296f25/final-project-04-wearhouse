export default function AddItemCard({ onClick }) {
  return (
    <button
      type="button"
      className="item-card add-item-card"
      onClick={onClick}
    >
      <div className="add-item-plus">+</div>
      <div className="add-item-text">Add Item</div>
    </button>
  );
}
