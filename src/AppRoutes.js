import { BrowserRouter, Routes, Route } from "react-router-dom";
import NewTournamentSetup from "./components/Setup/NewTournamentSetup";
import TeamSetup from "./components/Setup/TeamSetup";
import Running from "./components/Running/Running";
import TournamentLayout from "./layout/TournamentLayout";
import RequireTournament from "./routes/RequireTournament";
import NewTournamentLoadTournament from "./components/Setup/NewTournamentLoadTournament";
import LoadTournamentSetup from "./components/Setup/LoadTournamentSetup";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NewTournamentLoadTournament />} />
        <Route path="/newtournament" element={<NewTournamentSetup />} />
        <Route path="/loadtournament" element={<LoadTournamentSetup />} />
        <Route element={<RequireTournament />}>
          <Route path="/tournament/:tournamentId" element={<TournamentLayout />}>
            <Route path="teams" element={<TeamSetup />} />
            <Route path=":mode/running" element={<Running />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
