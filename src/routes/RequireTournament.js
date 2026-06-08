import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { checkIfTournamentExists, getTournamentData, statusToStage, koStageKey } from "../services/firestoreService";
import { useTournamentAuth } from "../hooks/useTournamentAuth";
import PinDialog from "../components/PinDialog";

// Alle gültigen Stage-Werte
function isValidStage(stage, koRounds) {
    if (!stage) return false;
    const validStages = [
        "preliminary",
        "standings",
        ...Array.from({ length: koRounds }, (_, i) => koStageKey(i + 1))
    ];
    return validStages.includes(stage);
}

export default function RequireTournament() {
    const { tournamentId, mode, stage } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [tournamentExists, setTournamentExists] = useState(false);
    const [correctStage, setCorrectStage] = useState(null);
    const [koRounds, setKoRounds] = useState(0);
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
            const rounds = data?.koRounds ?? 0;
            setKoRounds(rounds);
            setCorrectStage(statusToStage(data.status, rounds));
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

    // /teams-Route: kein mode → nur Existenz geprüft
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

    // Kein mode → View-Modus mit korrektem Stage
    if (!mode) {
        return <Navigate to={`/tournament/${tournamentId}/view/running/${correctStage}`} replace />;
    }

    // Stage fehlt oder ist kein gültiger Wert → auf aktuellen Stage umleiten
    // Gültiger aber "falscher" Stage (z.B. Tab-Wechsel) → NICHT umleiten
    if (!isValidStage(stage, koRounds)) {
        return (
            <Navigate
                to={`/tournament/${tournamentId}/${mode}/running/${correctStage}`}
                replace
            />
        );
    }

    return <Outlet />;
}