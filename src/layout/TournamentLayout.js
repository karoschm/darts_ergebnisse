import { Outlet } from "react-router-dom";
import { TournamentProvider } from "../context/TournamentContext";

export default function TournamentLayout() {
  return (
    <TournamentProvider>
      <Outlet />
    </TournamentProvider>
  );
}
