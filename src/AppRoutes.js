import { BrowserRouter, Routes, Route } from "react-router-dom";
import TournamentSetup from "./components/Setup/TournamentSetup";
import TeamSetup from "./components/Setup/TeamSetup";
import Preliminary from "./components/Running/Preliminary/Preliminary";
import Running from "./components/Running/Running";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentSetup/>} />
        <Route path="/tournament/:tournamendId/teams" element={<TeamSetup/>} />
        <Route path="/tournament/:tournamentId/running" element={<Running/>} />
      </Routes>
    </BrowserRouter>
  );
}
