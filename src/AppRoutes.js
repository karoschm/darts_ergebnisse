import { BrowserRouter, Routes, Route } from "react-router-dom";
import TournamentSetup from "./components/Setup/TournamentSetup";
import TeamSetup from "./components/Setup/TeamSetup";
import Preliminary from "./components/Preliminary/Preliminary";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentSetup />} />
        <Route path="/teams" element={<TeamSetup />} />
        <Route path="/group" element={<Preliminary />} />
      </Routes>
    </BrowserRouter>
  );
}
