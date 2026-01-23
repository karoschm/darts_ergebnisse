import { BrowserRouter, Routes, Route } from "react-router-dom";
import TournamentSetup from "./components/Setup/TournamentSetup";
import TeamSetup from "./components/Setup/TeamSetup";
import Running from "./components/Running/Running";
import TournamentLayout from "./layout/TournamentLayout";
import RequireTournament from "./routes/RequireTournament";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TournamentSetup />} />
        <Route element={<RequireTournament />}>
          <Route path="/tournament/:tournamentId" element={<TournamentLayout />}>
            <Route path="teams" element={<TeamSetup />} />
            <Route path="running" element={<Running />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
