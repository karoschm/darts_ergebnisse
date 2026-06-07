import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { checkIfTournamentExists, getTournamentData, statusToStage } from "../services/firestoreService";
import { useTournamentAuth } from "../hooks/useTournamentAuth";
import PinDialog from "../components/PinDialog";

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
            const data = await getTournamentData(tournamentId);
            // statusToStage braucht jetzt koRounds für dynamisches Mapping
            setCorrectStage(statusToStage(data.status, data.koRounds ?? 0));
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

    if (!tournamentExists) return <Navigate to="/" replace />;

    // /teams-Route: kein mode → nur Existenz geprüft, kein Redirect
    if (!mode) return <Outlet />;

    // Edit ohne Unlock → PIN-Dialog
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

    // Kein mode → View mit korrektem Stage
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