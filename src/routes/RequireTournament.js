import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { checkIfTournamentExists, getTournamentStatus } from "../services/firestoreService";
import { useTournamentAuth } from "../hooks/useTournamentAuth";
import PinDialog from "../components/PinDialog";

const statusToStage = {
    setup:    "preliminary",
    group:    "preliminary",
    qf:       "quarterfinal",
    sf:       "semifinal",
    final:    "final",
    finished: "standings"
};

export default function RequireTournament() {
    const { tournamentId, mode, stage } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [tournamentExists, setTournamentExists] = useState(false);
    const [correctStage, setCorrectStage] = useState(null);
    const [pinDialogOpen, setPinDialogOpen] = useState(false);

    const { isUnlocked, unlock } = useTournamentAuth(tournamentId);

    useEffect(() => {
        async function checkTournament() {
            const exists = await checkIfTournamentExists(tournamentId);
            if (!exists) {
                setTournamentExists(false);
                setLoading(false);
                return;
            }

            setTournamentExists(true);
            const status = await getTournamentStatus(tournamentId);
            setCorrectStage(statusToStage[status] ?? "preliminary");
            setLoading(false);
        }

        checkTournament();
    }, [tournamentId]);

    useEffect(() => {
        if (!loading && tournamentExists && mode === "edit" && !isUnlocked()) {
            setPinDialogOpen(true);
        }
    }, [loading, tournamentExists, mode]);

    const handlePinSuccess = () => {
        unlock();
        setPinDialogOpen(false);
        navigate(`/tournament/${tournamentId}/edit/running/${correctStage}`, { replace: true });
    };

    const handlePinCancel = () => {
        setPinDialogOpen(false);
        navigate("/", { replace: true });
    };

    if (loading) return <div>Lade Turnier...</div>;

    // Turnier existiert nicht → Startseite
    if (!tournamentExists) {
        return <Navigate to="/" replace />;
    }

    // /teams-Route explizit abfangen
    if (!mode && window.location.pathname.endsWith("/teams")) {
        return <Outlet />;
    }

    // Kein mode → View-Modus mit korrektem Stage
    if (!mode) {
        return (
            <Navigate
                to={`/tournament/${tournamentId}/view/running/${correctStage}`}
                replace
            />
        );
    }

    // Edit-Modus ohne Unlock → PIN-Dialog, Outlet noch nicht rendern
    if (mode === "edit" && !isUnlocked()) {
        return (
            <PinDialog
                open={pinDialogOpen}
                tournamentId={tournamentId}
                onSuccess={handlePinSuccess}
                onCancel={handlePinCancel}
            />
        );
    }

    // stage fehlt, ist falsch, oder running fehlt in der URL
    // → immer auf die korrekte vollständige URL umleiten
    if (!stage || stage !== correctStage) {
        return (
            <Navigate
                to={`/tournament/${tournamentId}/${mode}/running/${correctStage}`}
                replace
            />
        );
    }

    return <Outlet />;
}
