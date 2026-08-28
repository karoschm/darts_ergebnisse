import { Button, TextField, LinearProgress, IconButton, Stack, Paper } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

// Antwortmöglichkeit einer Auswahl-/Ja-Nein-Frage: löst beim Klick sofort die
// zugehörige State-Änderung aus und blättert automatisch zur nächsten Frage
// (Quiz-Charakter statt klassischer Formularfelder).
function ChoiceButton({ label, hint, selected, onClick, disabled }) {
    return (
        <Button
            variant={selected ? "contained" : "outlined"}
            onClick={onClick}
            disabled={disabled}
            sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.2, px: 2 }}
        >
            <span>
                {label}
                {hint && (
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 400 }}>
                        {hint}
                    </div>
                )}
            </span>
        </Button>
    );
}

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
    const [roundRobinHasKO, setRoundRobinHasKO] = useState(true);
    const [seeding, setSeeding] = useState("random");
    const [directKoTeamCount, setDirectKoTeamCount] = useState(8);
    const [koFormat, setKoFormat] = useState("single");
    const [bracketReset, setBracketReset] = useState(false);

    const [stepIndex, setStepIndex] = useState(0);

    const isDirectKO = mode === "directko";
    const directKoRounds = Math.ceil(Math.log2(Math.max(2, directKoTeamCount)));
    const directKoBracketSize = Math.pow(2, directKoRounds);
    const directKoByeCount = directKoBracketSize - directKoTeamCount;
    // Doppel-KO braucht ein "richtiges" Loser-Bracket (koRounds >= 2) und schließt
    // Freilose aus — daher nur bei exakter Zweierpotenz-Teamanzahl ab 4 wählbar.
    const directKoIsPowerOfTwo = directKoTeamCount >= 4 && directKoByeCount === 0;

    const { unlock } = useTournamentAuth(tournamentName.trim());

    // Nur Optionen anzeigen bei denen 2^rounds <= teamCount
    const availableKoOptions = useMemo(() => {
        return KO_ROUND_OPTIONS.filter(opt => Math.pow(2, opt.rounds) <= numberTeams);
    }, [numberTeams]);

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

    // Falls aktuell gewählte Option durch Teamanzahl-Änderung ungültig wird → zurücksetzen
    const handleTeamCountChange = (newCount) => {
        setNumberTeams(newCount);
        if (Math.pow(2, koRounds) > newCount) {
            const maxValid = Math.floor(Math.log2(newCount));
            setKoRounds(maxValid);
        }
        const perGroup = groupCount > 0 ? newCount / groupCount : newCount;
        const maxMatchdays = Math.max(1, perGroup - 1);
        setNumberMatchdays(prev => Math.min(Number(prev) || 1, maxMatchdays));
        const maxQualifiers = perGroup > 0 ? Math.pow(2, Math.floor(Math.log2(perGroup))) : 1;
        setQualifiersPerGroup(prev => Math.min(Number(prev) || 1, maxQualifiers));
    };

    const handleGroupCountChange = (newGroupCount) => {
        setGroupCount(newGroupCount);
        const perGroup = newGroupCount > 0 ? numberTeams / newGroupCount : numberTeams;
        const maxMatchdays = Math.max(1, perGroup - 1);
        setNumberMatchdays(prev => Math.min(Number(prev) || 1, maxMatchdays));
        const maxQualifiers = perGroup > 0 ? Math.pow(2, Math.floor(Math.log2(perGroup))) : 1;
        setQualifiersPerGroup(prev => Math.min(Number(prev) || 1, maxQualifiers));
    };

    // Doppel-KO-Auswahl zurücksetzen, falls die neue Teamanzahl keine gültige
    // Zweierpotenz mehr ist (analog zum bestehenden KO-Runden-Reset-Muster).
    const handleDirectKoTeamCountChange = (newCount) => {
        const clamped = Math.max(2, newCount);
        setDirectKoTeamCount(clamped);
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, clamped))));
        if (koFormat === "double" && !(clamped >= 4 && bracketSize === clamped)) {
            setKoFormat("single");
        }
    };

    const handlePinChange = (e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
    const handlePinConfirmChange = (e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));

    const goNext = () => setStepIndex(i => i + 1);
    const goBack = () => setStepIndex(i => Math.max(0, i - 1));

    // Die vollständige, fest geordnete Liste möglicher Fragen. Jede Frage entscheidet über
    // `visible`, ob sie im aktuellen Zustand überhaupt gestellt wird — dadurch ergibt sich
    // exakt derselbe bedingte Ablauf wie im vorherigen klassischen Formular, nur als
    // Schritt-für-Schritt Frage-Antwort-Dialog statt als einmal komplett sichtbares Formular.
    const allSteps = [
        {
            id: "mode",
            visible: true,
            question: "Wie soll das Turnier ablaufen?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton
                        label="Vorrunde + KO-Runde"
                        selected={!isDirectKO && roundRobinHasKO}
                        onClick={() => { setMode("roundrobin"); setRoundRobinHasKO(true); goNext(); }}
                    />
                    <ChoiceButton
                        label="Nur Vorrunde (keine KO-Runde)"
                        selected={!isDirectKO && !roundRobinHasKO}
                        onClick={() => { setMode("roundrobin"); setRoundRobinHasKO(false); setGroupCount(1); goNext(); }}
                    />
                    <ChoiceButton
                        label="Direkt-KO (ohne Vorrunde)"
                        selected={isDirectKO}
                        onClick={() => { setMode("directko"); goNext(); }}
                    />
                </Stack>
            ),
        },
        // --- Direkt-KO Zweig ---
        {
            id: "directKoTeamCount",
            visible: isDirectKO,
            question: "Wie viele Teams nehmen teil?",
            render: () => (
                <NumberQuestion
                    value={directKoTeamCount}
                    min={2}
                    onChange={handleDirectKoTeamCountChange}
                    onConfirm={goNext}
                    label="Anzahl Teams"
                    hint={`${koRoundLabel(directKoRounds, 1)} startet direkt mit ${directKoBracketSize} Plätzen${directKoByeCount > 0 ? ` (${directKoByeCount} Freilos${directKoByeCount > 1 ? "e" : ""} für die bestplatzierten Teams)` : ""}`}
                />
            ),
        },
        {
            id: "seeding",
            visible: isDirectKO,
            question: "Wie soll die Setzliste erstellt werden?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton label="Zufällige Auslosung" selected={seeding === "random"} onClick={() => { setSeeding("random"); goNext(); }} />
                    <ChoiceButton label="Manuelle Setzliste" selected={seeding === "manual"} onClick={() => { setSeeding("manual"); goNext(); }} />
                </Stack>
            ),
        },
        {
            id: "koFormatDouble",
            visible: isDirectKO && directKoIsPowerOfTwo,
            question: "Soll ein Doppel-KO (Loser-Bracket) gespielt werden?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton label="Ja, Doppel-KO" selected={koFormat === "double"} onClick={() => { setKoFormat("double"); goNext(); }} />
                    <ChoiceButton label="Nein, einfaches KO" selected={koFormat === "single"} onClick={() => { setKoFormat("single"); goNext(); }} />
                </Stack>
            ),
        },
        {
            id: "bracketReset",
            visible: isDirectKO && koFormat === "double",
            question: "Soll es einen Bracket Reset im Grand Final geben?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton
                        label="Ja"
                        hint="Sieger Loser-Bracket muss WB-Sieger zweimal schlagen"
                        selected={bracketReset === true}
                        onClick={() => { setBracketReset(true); goNext(); }}
                    />
                    <ChoiceButton label="Nein" selected={bracketReset === false} onClick={() => { setBracketReset(false); goNext(); }} />
                </Stack>
            ),
        },
        // --- Vorrunde-Zweig ---
        {
            id: "numberTeams",
            visible: !isDirectKO,
            question: "Wie viele Teams nehmen teil?",
            render: () => (
                <NumberQuestion
                    value={numberTeams}
                    min={2}
                    onChange={handleTeamCountChange}
                    onConfirm={goNext}
                    label="Anzahl Teams"
                />
            ),
        },
        {
            id: "groupCount",
            visible: !isDirectKO && !isPreliminaryOnly,
            question: "In wie viele Gruppen soll die Vorrunde aufgeteilt werden?",
            render: () => (
                <NumberQuestion
                    value={groupCount}
                    min={1}
                    onChange={handleGroupCountChange}
                    onConfirm={goNext}
                    label="Anzahl Gruppen"
                    hint={groupCount > 1
                        ? (numberTeams % groupCount === 0
                            ? `${numberTeams / groupCount} Teams pro Gruppe`
                            : "Die Teamanzahl muss durch die Gruppenanzahl teilbar sein")
                        : undefined}
                />
            ),
        },
        {
            id: "preliminaryFormat",
            visible: !isDirectKO && !isPreliminaryOnly && groupCount > 1,
            question: "Wie sollen die Spieltage der Vorrunde bestimmt werden?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton label="Jeder gegen Jeden" selected={preliminaryFormat === "full"} onClick={() => { setPreliminaryFormat("full"); goNext(); }} />
                    <ChoiceButton
                        label="Weniger Spieltage"
                        hint="Gruppengröße muss gerade sein"
                        selected={preliminaryFormat === "fixed"}
                        onClick={() => { setPreliminaryFormat("fixed"); goNext(); }}
                    />
                </Stack>
            ),
        },
        {
            id: "numberMatchdays",
            visible: !isDirectKO && !useFullRoundRobin,
            question: "Wie viele Spieltage soll die Vorrunde haben?",
            render: () => (
                <NumberQuestion
                    value={numberMatchdays}
                    min={1}
                    max={Math.max(1, teamsPerGroup - 1)}
                    onChange={setNumberMatchdays}
                    onConfirm={goNext}
                    label="Anzahl Spieltage Vorrunde"
                />
            ),
        },
        {
            id: "preliminaryScoreMode",
            visible: !isDirectKO,
            question: "Wie soll die Vorrunde gewertet werden?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton label="Punkte" selected={preliminaryScoreMode === "points"} onClick={() => { setPreliminaryScoreMode("points"); goNext(); }} />
                    <ChoiceButton label="Gewinnlegs" selected={preliminaryScoreMode === "legs"} onClick={() => { setPreliminaryScoreMode("legs"); goNext(); }} />
                </Stack>
            ),
        },
        {
            id: "winLegs",
            visible: !isDirectKO && preliminaryScoreMode === "legs",
            question: "Gewinnlegs: First to wie vielen?",
            render: () => (
                <NumberQuestion
                    value={winLegs}
                    min={1}
                    onChange={setWinLegs}
                    onConfirm={goNext}
                    label="Gewinnlegs"
                />
            ),
        },
        {
            id: "qualifiersPerGroup",
            visible: !isDirectKO && !isPreliminaryOnly && useGroups,
            question: "Wie viele Teams pro Gruppe qualifizieren sich für die KO-Runde?",
            render: () => {
                const max = teamsPerGroup > 0 ? Math.pow(2, Math.floor(Math.log2(teamsPerGroup))) : 1;
                return (
                    <NumberQuestion
                        value={qualifiersPerGroup}
                        min={1}
                        max={max}
                        onChange={setQualifiersPerGroup}
                        onConfirm={goNext}
                        label="Qualifikanten pro Gruppe"
                        hint={`${groupCount} Gruppen × ${qualifiersPerGroup} Qualifikanten = ${groupsQualifiedTotal} Teams` +
                            (groupsKoRoundsValid ? ` → ${koRoundLabel(groupsKoRounds, 1)}` : " (muss eine Zweierpotenz ergeben, z.B. 2, 4, 8, 16)")}
                    />
                );
            },
        },
        {
            id: "koRounds",
            visible: !isDirectKO && !isPreliminaryOnly && !useGroups,
            question: "Bei welcher Stufe soll die KO-Runde beginnen?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    {availableKoOptions.map(opt => (
                        <ChoiceButton
                            key={opt.rounds}
                            label={opt.label}
                            hint={`${Math.pow(2, opt.rounds)} Teams qualifizieren sich`}
                            selected={koRounds === opt.rounds}
                            onClick={() => { setKoRounds(opt.rounds); goNext(); }}
                        />
                    ))}
                </Stack>
            ),
        },
        // --- gemeinsam ---
        {
            id: "hasThirdPlace",
            visible: (isDirectKO || effectiveKoRounds > 0) && !(isDirectKO && koFormat === "double"),
            question: "Soll es ein Spiel um Platz 3 geben?",
            render: () => (
                <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                    <ChoiceButton label="Ja" selected={hasThirdPlace === true} onClick={() => { setHasThirdPlace(true); goNext(); }} />
                    <ChoiceButton label="Nein" selected={hasThirdPlace === false} onClick={() => { setHasThirdPlace(false); goNext(); }} />
                </Stack>
            ),
        },
        {
            id: "summary",
            visible: true,
            question: "Fast fertig – wie soll das Turnier heißen?",
            render: () => (
                <Stack spacing={2} sx={{ width: "100%", maxWidth: 320, alignItems: "center" }}>
                    <TextField
                        autoFocus
                        value={tournamentName}
                        onChange={e => setTournamentName(e.target.value)}
                        label="Turniername"
                        fullWidth
                    />
                    <TextField
                        type="password"
                        value={pin}
                        onChange={handlePinChange}
                        label="PIN für die Bearbeitung"
                        inputProps={{ inputMode: "numeric", maxLength: 4 }}
                        helperText="Nur Ziffern, genau 4 Stellen"
                        fullWidth
                    />
                    <TextField
                        type="password"
                        value={pinConfirm}
                        onChange={handlePinConfirmChange}
                        label="PIN bestätigen"
                        inputProps={{ inputMode: "numeric", maxLength: 4 }}
                        fullWidth
                    />
                    <Button type="submit" variant="contained">Turnier erstellen</Button>
                </Stack>
            ),
        },
    ];

    const steps = allSteps.filter(s => s.visible);
    const clampedIndex = Math.min(stepIndex, steps.length - 1);
    const currentStep = steps[clampedIndex];
    const progress = steps.length > 0 ? ((clampedIndex + 1) / steps.length) * 100 : 0;

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

            <div style={{ width: "100%", maxWidth: 420, marginBottom: 24 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <IconButton onClick={goBack} disabled={stepIndex === 0} aria-label="Zurück">
                        <ArrowBackIcon />
                    </IconButton>
                    <div style={{ flex: 1, fontSize: "0.8rem", opacity: 0.7 }}>
                        Frage {clampedIndex + 1} von {steps.length}
                    </div>
                </Stack>
                <LinearProgress variant="determinate" value={progress} />
            </div>

            {currentStep && (
                <Paper elevation={2} sx={{ p: 4, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <h2 style={{ marginTop: 0 }}>{currentStep.question}</h2>
                    {currentStep.render()}
                </Paper>
            )}

            {errorMessage && (
                <div style={{ color: "red", marginTop: "20px" }}>{errorMessage}</div>
            )}
        </form>
    );
}

// Frage mit numerischer Eingabe: eigener "Weiter"-Button statt Auto-Advance, da hier
// (anders als bei Auswahl-Fragen) erst getippt werden muss, bevor die Antwort feststeht.
function NumberQuestion({ value, min, max, onChange, onConfirm, label, hint }) {
    const isValid = (min === undefined || value >= min) && (max === undefined || value <= max);

    return (
        <Stack spacing={2} sx={{ width: "100%", maxWidth: 320, alignItems: "center" }}>
            <TextField
                type="number"
                autoFocus
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                inputProps={{ min, max }}
                label={label}
                fullWidth
                onKeyDown={e => { if (e.key === "Enter" && isValid) { e.preventDefault(); onConfirm(); } }}
            />
            {hint && <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{hint}</div>}
            <Button variant="contained" onClick={onConfirm} disabled={!isValid}>Weiter</Button>
        </Stack>
    );
}
