import { Button, MenuItem, Select, TableBody, TableCell, TableRow, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import { getAllTeams, updateTeamNames, updateTeamGroups, getTournamentData, groupLabel } from "../../services/firestoreService";

export default function TeamSetup() {
    const navigate = useNavigate();
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState({});
    const [teamNames, setTeamNames] = useState({});
    const [teamGroups, setTeamGroups] = useState({});
    const [groupCount, setGroupCount] = useState(1);
    const [tournamentMode, setTournamentMode] = useState("roundrobin");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        if (!currentTournamentId) return;

        async function fetchData() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            const realTeams = loadedTeams
                .filter(t => !t.isBye)
                .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
            setTeams(loadedTeams);

            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            const tournamentData = await getTournamentData(currentTournamentId);
            setTournamentMode(tournamentData?.mode ?? "roundrobin");
            const loadedGroupCount = tournamentData?.groupCount ?? 1;
            setGroupCount(loadedGroupCount);

            // Default-Gruppenzuweisung: reihum verteilt, vom Nutzer unten überschreibbar
            const groups = realTeams.reduce((acc, team, index) => {
                acc[team.id] = team.group ?? (index % loadedGroupCount);
                return acc;
            }, {});
            setTeamGroups(groups);
        }
        fetchData();
    }, [currentTournamentId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedNames = Object.fromEntries(
            Object.entries(teamNames).map(([key, value]) => [key, value.trim()])
        );

        await updateTeamNames(currentTournamentId, trimmedNames);
        if (groupCount > 1) {
            await updateTeamGroups(currentTournamentId, teamGroups);
        }

        if (tournamentMode === "directko") {
            navigate(`/tournament/${currentTournamentId}/seeding`);
        } else {
            navigate(`/tournament/${currentTournamentId}/edit/running/preliminary`);
        }
    };

    const handleInputChange = async (id, value) => {
        setTeamNames(prev => ({ ...prev, [id]: value }));
    };

    const handleGroupChange = (id, value) => {
        setTeamGroups(prev => ({ ...prev, [id]: Number(value) }));
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
                        .filter(t => !t.isBye)
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
                                {groupCount > 1 && (
                                    <TableCell key={`cell_group_${team.id}`}>
                                        <Select
                                            value={teamGroups[team.id] ?? 0}
                                            onChange={e => handleGroupChange(team.id, e.target.value)}
                                        >
                                            {Array.from({ length: groupCount }, (_, g) => (
                                                <MenuItem key={g} value={g}>Gruppe {groupLabel(g)}</MenuItem>
                                            ))}
                                        </Select>
                                    </TableCell>
                                )}
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