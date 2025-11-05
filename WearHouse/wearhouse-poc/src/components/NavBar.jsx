// src/components/NavBar.jsx
import { NavLink } from "react-router-dom";
export default function NavBar() {
    return (
        <nav className="navbar">
            <NavLink to="/" end className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>Overview</NavLink>
            <NavLink to="/browse" className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>Browse Data</NavLink>
\            <NavLink to="/users/new" className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>Sign Up</NavLink>
        </nav>
    );
}
