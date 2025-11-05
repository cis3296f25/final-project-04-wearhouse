import UploadForm from "../components/UploadForm";

export default function AddItem({ onAdded, setMessage }) {
  return <UploadForm onAdded={onAdded} onMessage={setMessage} />;
}
