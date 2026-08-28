import { Button, Checkbox, FormControlLabel, MenuItem, Select, TextField, FormControl, InputLabel, useTheme, useMediaQuery } from "@mui/material";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament, koRoundLabel } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";

const KO_ROUND_OPTIONS = [
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
    // Nur bei Gruppen relevant: "fixed" = feste, frei wählbare Spieltaganzahl (Gruppengröße
    // muss gerade sein), "full" = jeder gegen jeden (Spieltaganzahl ergibt sich aus der
    // Gruppengröße, auch ungerade Gruppengröße möglich — ein Team pro Runde spielfrei).
    const [preliminaryFormat, setPreliminaryFormat] = useState("full");
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [mode, setMode] = useState("roundrobin");
    // Nur relevant bei mode==="roundrobin": ob nach der Vorrunde eine KO-Runde folgt.
    // "Keine KO-Runde" ist bewusst Teil der obersten Turniermodus-Auswahl (statt einer
    // Option im KO-Runden-Anzahl-Wähler), da Gruppen zwingend eine KO-Runde brauchen
    // (siehe useGroups) und diese Entscheidung damit auf derselben Ebene wie "Direkt-KO"
    // getroffen werden muss, bevor Gruppen überhaupt zur Wahl stehen.
    const [roundRobinHasKO, setRoundRobinHasKO] = useState(true);
    const [seeding, setSeeding] = useState("random");
    const [directKoTeamCount, setDirectKoTeamCount] = useState(8);
    const [koFormat, setKoFormat] = useState("single");
    const [bracketReset, setBracketReset] = useState(false);

    const isDirectKO = mode === "directko";
    const directKoRounds = Math.ceil(Math.log2(Math.max(2, directKoTeamCount)));
    const directKoBracketSize = Math.pow(2, directKoRounds);
    const directKoByeCount = directKoBracketSize - directKoTeamCount;
    // Doppel-KO braucht ein "richtiges" Loser-Bracket (koRounds >= 2) und schließt
    // Freilose aus — daher nur bei exakter Zweierpotenz-Teamanzahl ab 4 wählbar.
    const directKoIsPowerOfTwo = directKoTeamCount >= 4 && directKoByeCount === 0;

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

    // Höchstens so viele Qualifikanten pro Gruppe, wie eine ganze KO-Runde füllen können —
    // da die Gruppenanzahl (wegen der Zweierpotenz-Validierung) selbst immer eine Zweierpotenz
    // ist, muss auch die Qualifikantenzahl pro Gruppe eine sein: die größte Zweierpotenz, die
    // nicht größer als die Gruppengröße ist (Bsp. 14 Teams/2 Gruppen → 7 Teams/Gruppe → max. 4).
    const maxQualifiersPerGroup = (teamsInGroup) =>
        teamsInGroup > 0 ? Math.pow(2, Math.floor(Math.log2(teamsInGroup))) : 1;

    const clampQualifiersPerGroup = (teamCount, newGroupCount) => {
        const perGroup = newGroupCount > 0 ? teamCount / newGroupCount : teamCount;
        const max = maxQualifiersPerGroup(perGroup);
        setQualifiersPerGroup(prev => Math.min(Number(prev) || 1, max));
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
        clampQualifiersPerGroup(newCount, groupCount);
    };

    // Doppel-KO-Auswahl zurücksetzen, falls die neue Teamanzahl keine gültige
    // Zweierpotenz mehr ist (analog zum bestehenden KO-Runden-Reset-Muster).
    const handleDirectKoTeamCountChange = (e) => {
        const newCount = Math.max(2, Number(e.target.value));
        setDirectKoTeamCount(newCount);
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, newCount))));
        if (koFormat === "double" && !(newCount >= 4 && bracketSize === newCount)) {
            setKoFormat("single");
        }
    };

    const handleGroupCountChange = (e) => {
        const newGroupCount = Math.max(1, Number(e.target.value));
        setGroupCount(newGroupCount);
        clampMatchdays(numberTeams, newGroupCount);
        clampQualifiersPerGroup(numberTeams, newGroupCount);
    };

    // Turniermodus-Auswahl bildet drei Optionen auf die zwei intern gespeicherten Werte
    // (mode: "roundrobin"/"directko") plus das separate roundRobinHasKO-Flag ab.
    const handleFormatChange = (e) => {
        const value = e.target.value;
        if (value === "directko") {
            setMode("directko");
            return;
        }
        setMode("roundrobin");
        setRoundRobinHasKO(value === "roundrobin_ko");
        if (value === "roundrobin_only") {
            setGroupCount(1); // Gruppen erfordern zwingend eine anschließende KO-Runde
        }
    };

    const handlePinChange = (e) => {
        setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    const handlePinConfirmChange = (e) => {
        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    // "Nur Vorrunde" (keine KO-Runde) ist eine eigene Turniermodus-Option; Gruppen sind dort
    // nicht wählbar, da sie zwingend eine anschließende KO-Runde voraussetzen (siehe useGroups).
    const isPreliminaryOnly = mode === "roundrobin" && !roundRobinHasKO;

    // Bei Gruppen ergibt sich die KO-Rundenanzahl aus Gruppenanzahl × Qualifikanten/Gruppe,
    // statt sie (redundant und potenziell widersprüchlich) separat abzufragen.
    const useGroups = mode === "roundrobin" && roundRobinHasKO && groupCount > 1;
    const teamsPerGroup = groupCount > 0 ? numberTeams / groupCount : 0;
    const groupsQualifiedTotal = groupCount * qualifiersPerGroup;
    const groupsKoRoundsValid = groupsQualifiedTotal > 0 && Number.isInteger(Math.log2(groupsQualifiedTotal));
    const groupsKoRounds = groupsKoRoundsValid ? Math.log2(groupsQualifiedTotal) : 0;

    // "Jeder gegen jeden": Spieltaganzahl ergibt sich aus der Gruppengröße statt frei wählbar
    // zu sein — dadurch ist auch eine ungerade Gruppengröße möglich (ein Team pro Runde
    // spielfrei, rotierend). Kein eigenes Freilos-Team nötig: "BYE" wird beim Erzeugen des
    // Spielplans (Preliminary.js) rein als String-Marker in die Team-ID-Liste eingefügt,
    // saveSchedule/addTeamGame (firestoreService.js) behandeln ihn bereits überall als reinen
    // Sentinel statt als echte Team-Entität.
    const useFullRoundRobin = useGroups && preliminaryFormat === "full";
    const fullRoundRobinMatchdays = teamsPerGroup > 0
        ? (teamsPerGroup % 2 === 0 ? Math.max(1, teamsPerGroup - 1) : teamsPerGroup)
        : 1;
    const effectiveNumberMatchdays = useFullRoundRobin ? fullRoundRobinMatchdays : numberMatchdays;

    const effectiveKoRounds = isDirectKO
        ? directKoRounds
        : isPreliminaryOnly
            ? 0
            : useGroups
                ? groupsKoRounds
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
            if (!useFullRoundRobin && teamsPerGroup % 2 !== 0) {
                return showError("Jede Gruppe muss eine gerade Anzahl Teams haben (oder \"Jeder gegen jeden\" wählen).");
            }
            if (qualifiersPerGroup > teamsPerGroup) {
                return showError("Qualifikanten pro Gruppe darf nicht größer als die Gruppengröße sein.");
            }
            if (!groupsKoRoundsValid) {
                return showError("Gruppenanzahl × Qualifikanten pro Gruppe muss eine Zweierpotenz ergeben (z.B. 2, 4, 8, 16).");
            }
        }

        if (isDirectKO && koFormat === "double" && !directKoIsPowerOfTwo) {
            return showError("Doppel-KO erfordert eine Teamanzahl, die eine Zweierpotenz ist (mindestens 4).");
        }

        const effectiveTeamCount = isDirectKO ? directKoTeamCount : numberTeams;
        const effectiveGroupCount = isDirectKO ? 1 : groupCount;
        const effectiveHasThirdPlace = isDirectKO && koFormat === "double" ? false : hasThirdPlace;
        const effectiveKoFormat = isDirectKO ? koFormat : "single";

        const tournamentID = await addTournament(
            trimmedName, effectiveTeamCount, effectiveNumberMatchdays, effectiveKoRounds, effectiveHasThirdPlace, pin,
            preliminaryScoreMode, winLegs, mode, seeding, effectiveGroupCount, qualifiersPerGroup,
            effectiveKoFormat, bracketReset
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
                    value={isDirectKO ? "directko" : (roundRobinHasKO ? "roundrobin_ko" : "roundrobin_only")}
                    label="Turniermodus"
                    onChange={handleFormatChange}
                >
                    <MenuItem value="roundrobin_ko">Vorrunde + KO-Runde</MenuItem>
                    <MenuItem value="roundrobin_only">Nur Vorrunde (keine KO-Runde)</MenuItem>
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
                        onChange={handleDirectKoTeamCountChange}
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

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={koFormat === "double"}
                                disabled={!directKoIsPowerOfTwo}
                                onChange={e => setKoFormat(e.target.checked ? "double" : "single")}
                            />
                        }
                        label="Doppel-KO (Loser-Bracket)"
                    />
                    {!directKoIsPowerOfTwo && (
                        <div style={{ fontSize: "0.85rem", opacity: 0.7, maxWidth: 320 }}>
                            Doppel-KO ist nur bei einer Teamanzahl verfügbar, die eine Zweierpotenz ist (4, 8, 16, ...).
                        </div>
                    )}
                    {koFormat === "double" && (
                        <>
                            <br />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={bracketReset}
                                        onChange={e => setBracketReset(e.target.checked)}
                                    />
                                }
                                label="Bracket Reset im Grand Final (Sieger Loser-Bracket muss WB-Sieger zweimal schlagen)"
                            />
                        </>
                    )}
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

                    {!isPreliminaryOnly && (
                        <>
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

                            {groupCount > 1 && (
                                <>
                                    <label>Wie sollen die Spieltage der Vorrunde bestimmt werden?</label>
                                    <br />
                                    <FormControl sx={{ minWidth: 280 }}>
                                        <InputLabel>Vorrundenformat</InputLabel>
                                        <Select
                                            value={preliminaryFormat}
                                            label="Vorrundenformat"
                                            onChange={e => setPreliminaryFormat(e.target.value)}
                                        >
                                            <MenuItem value="full">Jeder gegen Jeden</MenuItem>
                                            <MenuItem value="fixed">Weniger Spieltage (Gruppengröße muss gerade sein)</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <br /><br />
                                </>
                            )}
                        </>
                    )}

                    {useFullRoundRobin ? (
                        <div style={{ marginBottom: 16, fontSize: "0.85rem", opacity: 0.7 }}>
                            Jeder gegen jeden: {fullRoundRobinMatchdays} Spieltage
                            {teamsPerGroup % 2 !== 0 && ` (${teamsPerGroup} Teams/Gruppe — ungerade, daher hat pro Spieltag ein Team spielfrei)`}
                        </div>
                    ) : (
                        <>
                            <label>Wie viele Spieltage soll die Vorrunde haben?</label>
                            <TextField
                                type="number"
                                value={numberMatchdays}
                                onChange={e => setNumberMatchdays(e.target.value)}
                                inputProps={{ min: 1, max: Math.max(1, teamsPerGroup - 1) }}
                                label="Anzahl Spieltage Vorrunde"
                            />
                            <br /><br />
                        </>
                    )}

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

                    {!isPreliminaryOnly && (
                        useGroups ? (
                            <>
                                <label>Wie viele Teams pro Gruppe qualifizieren sich für die KO-Runde?</label>
                                <TextField
                                    type="number"
                                    value={qualifiersPerGroup}
                                    onChange={e => setQualifiersPerGroup(Math.min(Number(e.target.value), maxQualifiersPerGroup(teamsPerGroup)))}
                                    inputProps={{ min: 1, max: maxQualifiersPerGroup(teamsPerGroup) }}
                                    label="Qualifikanten pro Gruppe"
                                />
                                <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: groupsKoRoundsValid ? 0.7 : 1, color: groupsKoRoundsValid ? "inherit" : "orange" }}>
                                    {groupCount} Gruppen × {qualifiersPerGroup} Qualifikanten = {groupsQualifiedTotal} Teams
                                    {groupsKoRoundsValid
                                        ? ` → ${koRoundLabel(groupsKoRounds, 1)}`
                                        : " (muss eine Zweierpotenz ergeben, z.B. 2, 4, 8, 16)"}
                                </div>
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
                                <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
                                    {qualifiedTeams} Teams qualifizieren sich für die KO-Runde
                                </div>
                            </>
                        )
                    )}
                    <br />
                </>
            )}

            {(isDirectKO || effectiveKoRounds > 0) && !(isDirectKO && koFormat === "double") && (
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