import * as XLSX from "xlsx";
import {
    getAllMatchdays, getAllTeams, getKnockout, getTournamentData,
    koStageKey, koRoundLabel, groupLabel, loserStageKey, loserRoundLabel,
    getLbSchedule, GRAND_FINAL_STAGE, GRAND_FINAL_RESET_STAGE
} from "./firestoreService";

function appendKORound(workbook, sheetName, roundData) {
    if (!roundData?.matches) return;
    const rows = [];

    Object.entries(roundData.matches).forEach(([matchId, match]) => {
        rows.push({
            Spiel: matchId,
            Team1: match.team1,
            Legs1: match[`legs_${match.team1}`],
            Team2: match.team2,
            Legs2: match[`legs_${match.team2}`],
            Gespielt: match.played ? "Ja" : "Nein"
        });
    });

    const sheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        // Excel erlaubt max. 31 Zeichen und keine Sonderzeichen im Sheet-Namen
        sheetName.slice(0, 31)
    );
}

function getTableOrder(teams, scoreMode = "points") {
    const sortedTeams = Object.values(teams)
        .filter(t => !t.isBye)
        .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (scoreMode === "legs") {
                if (b.own_score !== a.own_score) return b.own_score - a.own_score;
                return a.opponent_score - b.opponent_score;
            }
            if (b.own_score !== a.own_score) return a.own_score - b.own_score;
            return b.opponent_score - a.opponent_score;
        });
    return sortedTeams;
}

// Turnierstatus wird bewusst nicht mehr zur Steuerung genutzt (die früheren festen
// Stage-Namen "quarterfinals"/"semifinals"/"final" existieren im aktuellen Schema
// nicht mehr, und die Rundenanzahl ist variabel) — stattdessen wird für jede
// mögliche Runde/Gruppe/Bracket-Stage direkt per getKnockout geprüft, ob bereits
// Daten existieren, und nur dann ein Sheet angelegt.
export async function exportTournamentResults(tournamentId) {
    const tournamentData = await getTournamentData(tournamentId);
    if (!tournamentData) return;

    const preliminaryScoreMode = tournamentData.preliminaryScoreMode ?? "points";
    const preliminaryFieldPrefix = preliminaryScoreMode === "legs" ? "legs" : "score";
    const mode = tournamentData.mode ?? "roundrobin";
    const koRounds = tournamentData.koRounds ?? 0;
    const koFormat = tournamentData.koFormat ?? "single";
    const bracketReset = tournamentData.bracketReset ?? false;
    const groupCount = tournamentData.groupCount ?? 1;

    const teams = await getAllTeams(tournamentId);

    const workbook = XLSX.utils.book_new();

    if (tournamentData.status === "finished") {
        // Abschlussplatzierungen
        const standingsSheet = XLSX.utils.json_to_sheet(
            teams
                .filter(t => !t.isBye)
                .sort((t1, t2) => t1.finalRank - t2.finalRank)
                .map(team => ({
                    Team: team.name,
                    FinalePlatzierung: team.finalRank
                }))
        );

        XLSX.utils.book_append_sheet(workbook, standingsSheet, "Platzierungen");
    }

    // Teams (gruppen-aware)
    const teamsSheet = XLSX.utils.json_to_sheet(
        teams
            .filter(t => !t.isBye)
            .map(team => ({
                Team: team.name,
                ...(groupCount > 1 ? { Gruppe: groupLabel(team.group ?? 0) } : {})
            }))
    );
    XLSX.utils.book_append_sheet(workbook, teamsSheet, "Teams");

    // Vorrunde (nur bei Vorrunde+KO bzw. Nur-Vorrunde-Turnieren, nicht bei Direkt-KO)
    if (mode !== "directko") {
        const matchdays = await getAllMatchdays(tournamentId);

        if (matchdays.length > 0) {
            const preliminaryRows = [];
            matchdays.forEach(matchday => {
                Object.entries(matchday.matches || {}).forEach(([matchId, match]) => {
                    preliminaryRows.push({
                        Spieltag: Number(matchday.id) + 1,
                        ...(groupCount > 1 ? { Gruppe: groupLabel(match.group ?? 0) } : {}),
                        Team1: match.team1,
                        Punkte1: match[`${preliminaryFieldPrefix}_${match.team1}`],
                        Team2: match.team2,
                        Punkte2: match[`${preliminaryFieldPrefix}_${match.team2}`],
                        Gespielt: match.played ? "Ja" : "Nein"
                    });
                });
            });

            const preliminarySheet = XLSX.utils.json_to_sheet(preliminaryRows);
            XLSX.utils.book_append_sheet(workbook, preliminarySheet, "Vorrunde_Ergebnisse");
        }

        // Abschlussplatzierungen Vorrunde (pro Gruppe, falls vorhanden)
        const standingsRows = [];
        for (let g = 0; g < groupCount; g++) {
            const groupTeams = groupCount > 1
                ? teams.filter(t => (t.group ?? 0) === g)
                : teams;
            getTableOrder(groupTeams, preliminaryScoreMode).forEach((team, index) => {
                standingsRows.push({
                    ...(groupCount > 1 ? { Gruppe: groupLabel(g) } : {}),
                    Platzierung: index + 1,
                    Team: team.name,
                    Siege: team.wins,
                    Niederlagen: team.losses,
                    PunkteVerhältnis: `${team.own_score}:${team.opponent_score}`
                });
            });
        }

        if (standingsRows.length > 0) {
            const standingsPreliminarySheet = XLSX.utils.json_to_sheet(standingsRows);
            XLSX.utils.book_append_sheet(workbook, standingsPreliminarySheet, "Vorrunde_Tabelle");
        }
    }

    // Winner-Bracket / einfaches KO
    for (let r = 1; r <= koRounds; r++) {
        const roundData = await getKnockout(tournamentId, koStageKey(r));
        appendKORound(workbook, koRoundLabel(koRounds, r), roundData);
    }

    // Loser-Bracket + Grand Final (Doppel-KO, nur bei Direkt-KO möglich)
    if (mode === "directko" && koFormat === "double") {
        const lbSchedule = getLbSchedule(koRounds);
        for (let r = 1; r <= lbSchedule.length; r++) {
            const roundData = await getKnockout(tournamentId, loserStageKey(r));
            appendKORound(workbook, loserRoundLabel(koRounds, r), roundData);
        }

        const grandFinal = await getKnockout(tournamentId, GRAND_FINAL_STAGE);
        appendKORound(workbook, "Grand Final", grandFinal);

        if (bracketReset) {
            const grandFinalReset = await getKnockout(tournamentId, GRAND_FINAL_RESET_STAGE);
            appendKORound(workbook, "Grand Final Reset", grandFinalReset);
        }
    }

    XLSX.writeFile(workbook, `${tournamentId}_Ergebnisse.xlsx`);
}
