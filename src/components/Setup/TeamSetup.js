import { Button, TableBody, TableCell, TableRow, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import { getAllTeams, updateTeamNames } from "../../services/firestoreService";

export default function TeamSetup() {
    const navigate = useNavigate();
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState({});
    const [teamNames, setTeamNames] = useState({});

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        if (!currentTournamentId) return;

        async function fetchData() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            setTeams(loadedTeams);

            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);
        }
        fetchData();
    }, [currentTournamentId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedNames = Object.fromEntries(
            Object.entries(teamNames).map(([key, value]) => [key, value.trim()])
        );

        await updateTeamNames(currentTournamentId, trimmedNames);

        navigate(`/tournament/${currentTournamentId}/edit/running/preliminary`);
    };

    const handleInputChange = async (id, value) => {
        setTeamNames(prev => ({ ...prev, [id]: value }));
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "40px"
            }}
        >
            <h2>Teamnamen</h2>
            <table style={{
                borderCollapse: "collapse",
                alignContent: "center"
            }}>
                <TableBody>
                    {Object.values(teams)
                        .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
                        .map(team =>
                            <TableRow key={`row_${team.id}`}>
                                <TableCell key={`cell_label_${team.id}`}>
                                    <label key={`label_${team.id}`}>{team.id}</label>
                                </TableCell>
                                <TableCell key={`cell_input_${team.id}`}>
                                    <TextField
                                        key={`label_${team.id}`}
                                        value={teamNames[team.id]}
                                        onChange={e => handleInputChange(team.id, e.target.value)}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                </TableBody>
            </table>
            <br />
            <Button type="submit">
                Turnier starten
            </Button>
        </form>
    );
}