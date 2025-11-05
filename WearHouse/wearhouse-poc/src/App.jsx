import { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useItems } from "./hooks/useItems";
import NavBar from "./components/NavBar";
import Overview from "./pages/Overview";
import AddItem from "./pages/AddItem";
import Items from "./pages/Items";
import Login from "./pages/Login";
import Browse from "./pages/Browse";
import SignUp from "./pages/SignUp";
import Account from "./pages/Account";
import RequireAuth from "./components/RequireAuth";
import CreateUser from "./pages/CreateUser";

import "./App.css";

async function getMockWeather() { return { tempF: 55, condition: "Rain" }; }
async function getMockEvent() { return { title: "Client Presentation", formality: "formal" }; }

export default function App() {
  const [message, setMessage] = useState("");
  const { items, loadItems } = useItems();

  return (
    <div className="app-shell">
      <header className="header">
        <h1 className="brand"><Link to="/" className="navlink">WearHouse</Link></h1>
        <NavBar />
      </header>

      <div className="message" aria-live="polite">{message}</div>

      <Routes>
        <Route path="/" element={
          <Overview items={items} setMessage={setMessage} getWeather={getMockWeather} getEvent={getMockEvent} />
        } />
        <Route path="/items" element={<Items items={items} />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<SignUp />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/auth/signup" element={<SignUp />} />
        <Route path="/users/new" element={<CreateUser />} />

        <Route path="/account" element={
          <RequireAuth><Account /></RequireAuth>
        } />
        <Route path="/add" element={
          <RequireAuth><AddItem onAdded={loadItems} setMessage={setMessage} /></RequireAuth>
        } />
      </Routes>
    </div>
  );
}
