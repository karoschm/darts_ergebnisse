import { Button, Checkbox, FormControlLabel, MenuItem, Select, TextField, FormControl, InputLabel, useTheme, useMediaQuery } from "@mui/material";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament, koRoundLabel } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";

const KO_ROUND_OPTIONS = [
    { label: "Keine KO-Runde", rounds: 0 },
    { label: "Finale",         rounds: 1 },
    { label: "Halbfinale",     rounds: 2 },
    { label: "Viertelfinale",  rounds: 3 },
    { label: "Achtelfinale",   rounds: 4 },
    { label: "Last 32",        rounds: 5 },
    { label: "Last 64",        rounds: 6 },
];


export default function NewTournamentSetup() {
    const navigate = useNavigate();
    const { errorMessage, showError } = useFormStatus();

    const [numberTeams, setNumberTeams] = useState(8);
    const [numberMatchdays, setNumberMatchdays] = useState(1);
    const [tournamentName, setTournamentName] = useState("");
    const [koRounds, setKoRounds] = useState(3);
    const [hasThirdPlace, setHasThirdPlace] = useState(true);
    const [preliminaryScoreMode, setPreliminaryScoreMode] = useState("points");
    const [winLegs, setWinLegs] = useState(3);
    const [groupCount, setGroupCount] = useState(1);
    const [qualifiersPerGroup, setQualifiersPerGroup] = useState(1);
    const [hasKnockoutAfterGroups, setHasKnockoutAfterGroups] = useState(true);
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [mode, setMode] = useState("roundrobin");
    const [seeding, setSeeding] = useState("random");
    const [directKoTeamCount, setDirectKoTeamCount] = useState(8);

    const isDirectKO = mode === "directko";
    const directKoRounds = Math.ceil(Math.log2(Math.max(2, directKoTeamCount)));
    const directKoBracketSize = Math.pow(2, directKoRounds);
    const directKoByeCount = directKoBracketSize - directKoTeamCount;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { unlock } = useTournamentAuth(tournamentName.trim());

    // Nur Optionen anzeigen bei denen 2^rounds <= teamCount
    const availableKoOptions = useMemo(() => {
        return KO_ROUND_OPTIONS.filter(opt => Math.pow(2, opt.rounds) <= numberTeams);
    }, [numberTeams]);

    // Maximal sinnvolle Spieltagsanzahl: vollständiger Rundenplan innerhalb einer Gruppe (n-1),
    // nicht bezogen auf die Gesamtteamzahl — Gruppen spielen unabhängig voneinander.
    const clampMatchdays = (teamCount, newGroupCount) => {
        const perGroup = newGroupCount > 0 ? teamCount / newGroupCount : teamCount;
        const maxMatchdays = Math.max(1, perGroup - 1);
        setNumberMatchdays(prev => Math.min(Number(prev) || 1, maxMatchdays));
    };

    // Falls aktuell gewählte Option durch Teamanzahl-Änderung ungültig wird → zurücksetzen
    const handleTeamCountChange = (e) => {
        const newCount = Number(e.target.value);
        setNumberTeams(newCount);
        if (Math.pow(2, koRounds) > newCount) {
            // Auf größte noch mögliche Option zurücksetzen
            const maxValid = Math.floor(Math.log2(newCount));
            setKoRounds(maxValid);
        }
        clampMatchdays(newCount, groupCount);
    };

    const handleGroupCountChange = (e) => {
        const newGroupCount = Math.max(1, Number(e.target.value));
        setGroupCount(newGroupCount);
        clampMatchdays(numberTeams, newGroupCount);
    };

    const handlePinChange = (e) => {
        setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    const handlePinConfirmChange = (e) => {
        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    // Bei Gruppen ergibt sich die KO-Rundenanzahl aus Gruppenanzahl × Qualifikanten/Gruppe,
    // statt sie (redundant und potenziell widersprüchlich) separat abzufragen.
    const useGroups = !isDirectKO && groupCount > 1;
    const teamsPerGroup = groupCount > 0 ? numberTeams / groupCount : 0;
    const groupsQualifiedTotal = groupCount * qualifiersPerGroup;
    const groupsKoRoundsValid = groupsQualifiedTotal > 0 && Number.isInteger(Math.log2(groupsQualifiedTotal));
    const groupsKoRounds = groupsKoRoundsValid ? Math.log2(groupsQualifiedTotal) : 0;

    const effectiveKoRounds = isDirectKO
        ? directKoRounds
        : useGroups
            ? (hasKnockoutAfterGroups ? groupsKoRounds : 0)
            : koRounds;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = tournamentName.trim();
        if (pin.length !== 4) return showError("Der PIN muss genau 4 Ziffern haben.");
        if (pin !== pinConfirm) return showError("Die PINs stimmen nicht überein.");

        if (useGroups) {
            if (numberTeams % groupCount !== 0) {
                return showError("Die Teamanzahl muss durch die Gruppenanzahl teilbar sein (gleich große Gruppen).");
            }
            if (teamsPerGroup % 2 !== 0) {
                return showError("Jede Gruppe muss eine gerade Anzahl Teams haben.");
            }
            if (hasKnockoutAfterGroups) {
                if (qualifiersPerGroup > teamsPerGroup) {
                    return showError("Qualifikanten pro Gruppe darf nicht größer als die Gruppengröße sein.");
                }
                if (!groupsKoRoundsValid) {
                    return showError("Gruppenanzahl × Qualifikanten pro Gruppe muss eine Zweierpotenz ergeben (z.B. 2, 4, 8, 16).");
                }
            }
        }

        const effectiveTeamCount = isDirectKO ? directKoTeamCount : numberTeams;
        const effectiveGroupCount = isDirectKO ? 1 : groupCount;

        const tournamentID = await addTournament(
            trimmedName, effectiveTeamCount, numberMatchdays, effectiveKoRounds, hasThirdPlace, pin,
            preliminaryScoreMode, winLegs, mode, seeding, effectiveGroupCount, qualifiersPerGroup
        );

        if (tournamentID === trimmedName) {
            unlock();
            navigate(`/tournament/${tournamentID}/teams`);
        } else if (tournamentID === `${trimmedName}_EXISTS`) {
            return showError("Turniername bereits vorhanden!");
        } else {
            return showError("Fehler bei der Turniererstellung!");
        }
    };

    const qualifiedTeams = Math.pow(2, koRounds);

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
            <h1>Turnier konfigurieren</h1>

            <label>Turniermodus</label>
            <br />
            <FormControl sx={{ minWidth: 260 }}>
                <InputLabel>Turniermodus</InputLabel>
                <Select
                    value={mode}
                    label="Turniermodus"
                    onChange={e => setMode(e.target.value)}
                >
                    <MenuItem value="roundrobin">Vorrunde + KO-Runde</MenuItem>
                    <MenuItem value="directko">Direkt-KO (ohne Vorrunde)</MenuItem>
                </Select>
            </FormControl>
            <br /><br />

            {isDirectKO ? (
                <>
                    <label>Wie viele Teams nehmen teil?</label>
                    <TextField
                        type="number"
                        value={directKoTeamCount}
                        onChange={e => setDirectKoTeamCount(Math.max(2, Number(e.target.value)))}
                        inputProps={{ min: 2 }}
                        label="Anzahl Teams"
                    />
                    <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
                        {koRoundLabel(directKoRounds, 1)} startet direkt mit {directKoBracketSize} Plätzen
                        {directKoByeCount > 0 && ` (${directKoByeCount} Freilos${directKoByeCount > 1 ? "e" : ""} für die bestplatzierten Teams)`}
                    </div>
                    <br /><br />

                    <label>Wie soll die Setzliste erstellt werden?</label>
                    <br />
                    <FormControl sx={{ minWidth: 260 }}>
                        <InputLabel>Setzliste</InputLabel>
                        <Select
                            value={seeding}
                            label="Setzliste"
                            onChange={e => setSeeding(e.target.value)}
                        >
                            <MenuItem value="random">Zufällige Auslosung</MenuItem>
                            <MenuItem value="manual">Manuelle Setzliste</MenuItem>
                        </Select>
                    </FormControl>
                    <br /><br />
                </>
            ) : (
                <>
                    <label>Wie viele Teams nehmen teil?</label>
                    <TextField
                        type="number"
                        value={numberTeams}
                        onChange={handleTeamCountChange}
                        inputProps={{ min: 2 }}
                        label="Anzahl Teams"
                    />
                    <br /><br />

                    <label>In wie viele Gruppen soll die Vorrunde aufgeteilt werden?</label>
                    <TextField
                        type="number"
                        value={groupCount}
                        onChange={handleGroupCountChange}
                        inputProps={{ min: 1 }}
                        label="Anzahl Gruppen"
                    />
                    {groupCount > 1 && (
                        <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
                            {numberTeams % groupCount === 0
                                ? `${numberTeams / groupCount} Teams pro Gruppe`
                                : "Die Teamanzahl muss durch die Gruppenanzahl teilbar sein"}
                        </div>
                    )}
                    <br /><br />

                    <label>Wie viele Spieltage soll die Vorrunde haben?</label>
                    <TextField
                        type="number"
                        value={numberMatchdays}
                        onChange={e => setNumberMatchdays(e.target.value)}
                        inputProps={{ min: 1, max: Math.max(1, teamsPerGroup - 1) }}
                        label="Anzahl Spieltage Vorrunde"
                    />
                    <br /><br />

                    <label>Wie soll die Vorrunde gewertet werden?</label>
                    <br />
                    <FormControl sx={{ minWidth: 220 }}>
                        <InputLabel>Wertungsmodus Vorrunde</InputLabel>
                        <Select
                            value={preliminaryScoreMode}
                            label="Wertungsmodus Vorrunde"
                            onChange={e => setPreliminaryScoreMode(e.target.value)}
                        >
                            <MenuItem value="points">Punkte</MenuItem>
                            <MenuItem value="legs">Gewinnlegs</MenuItem>
                        </Select>
                    </FormControl>
                    {preliminaryScoreMode === "legs" && (
                        <>
                            <br /><br />
                            <label>Gewinnlegs: First to</label>
                            <TextField
                                type="number"
                                value={winLegs}
                                onChange={e => setWinLegs(Number(e.target.value))}
                                inputProps={{ min: 1 }}
                                label="Gewinnlegs"
                            />
                        </>
                    )}
                    <br /><br />

                    {useGroups ? (
                        <>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={hasKnockoutAfterGroups}
                                        onChange={e => setHasKnockoutAfterGroups(e.target.checked)}
                                    />
                                }
                                label="Anschließende KO-Runde"
                            />
                            {hasKnockoutAfterGroups && (
                                <>
                                    <br /><br />
                                    <label>Wie viele Teams pro Gruppe qualifizieren sich für die KO-Runde?</label>
                                    <TextField
                                        type="number"
                                        value={qualifiersPerGroup}
                                        onChange={e => setQualifiersPerGroup(Number(e.target.value))}
                                        inputProps={{ min: 1 }}
                                        label="Qualifikanten pro Gruppe"
                                    />
                                    <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: groupsKoRoundsValid ? 0.7 : 1, color: groupsKoRoundsValid ? "inherit" : "orange" }}>
                                        {groupCount} Gruppen × {qualifiersPerGroup} Qualifikanten = {groupsQualifiedTotal} Teams
                                        {groupsKoRoundsValid
                                            ? ` → ${koRoundLabel(groupsKoRounds, 1)}`
                                            : " (muss eine Zweierpotenz ergeben, z.B. 2, 4, 8, 16)"}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <label>Bei welcher Stufe soll die KO-Runde beginnen?</label>
                            <br />
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel>KO-Runde beginnen bei</InputLabel>
                                <Select
                                    value={koRounds}
                                    label="KO-Runde beginnen bei"
                                    onChange={e => setKoRounds(Number(e.target.value))}
                                >
                                    {availableKoOptions.map(opt => (
                                        <MenuItem key={opt.rounds} value={opt.rounds}>
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {koRounds > 0 && (
                                <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
                                    {qualifiedTeams} Teams qualifizieren sich für die KO-Runde
                                </div>
                            )}
                        </>
                    )}
                    <br />
                </>
            )}

            {(isDirectKO || effectiveKoRounds > 0) && (
                <>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={hasThirdPlace}
                                onChange={e => setHasThirdPlace(e.target.checked)}
                            />
                        }
                        label="Spiel um Platz 3"
                    />
                    <br />
                </>
            )}
            <br />

            <label>Bitte wähle einen Namen für das Turnier</label>
            <TextField
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
                label="Turniername"
            />
            <br /><br />

            <label>PIN für die Bearbeitung (4 Ziffern)</label>
            <TextField
                type="password"
                value={pin}
                onChange={handlePinChange}
                label="PIN"
                inputProps={{ inputMode: "numeric", maxLength: 4 }}
                helperText="Nur Ziffern, genau 4 Stellen"
            />

            <TextField
                type="password"
                value={pinConfirm}
                onChange={handlePinConfirmChange}
                label="PIN bestätigen"
                inputProps={{ inputMode: "numeric", maxLength: 4 }}
            />
            <br /><br />

            <Button type="submit">Turnier erstellen</Button>

            {errorMessage && (
                <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>
            )}
        </form>
    );
}