import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { checkIfTeamsExist, checkIfTournamentExists } from "../services/firestoreService";

export default function RequireTournament() {
    const { tournamentId } = useParams();
    const [loading, setLoading] = useState(true);
    const [tournamentExists, setTournamentExists] = useState(false);

    useEffect(() => {
        async function checkTournament() {
            const checkTournament = await checkIfTournamentExists(tournamentId);
            setTournamentExists(checkTournament);
            setLoading(false);
        }

        checkTournament();
    }, [tournamentId]);

    if (loading) return <div>Lade Turnier...</div>;

    if (!tournamentExists) {
        return <Navigate to={`/`} replace />;
    }

    return <Outlet />;
}
