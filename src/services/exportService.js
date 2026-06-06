import * as XLSX from "xlsx";
import { getAllMatchdays, getAllTeams, getKnockout } from "./firestoreService";

function appendKORound(
    workbook,
    sheetName,
    roundData
) {
    const rows = [];

    Object.entries(roundData.matches || {}).forEach(
        ([matchId, match]) => {
            rows.push({
                Spiel: matchId,
                Team1: match.team1,
                Legs1: match[`legs_${match.team1}`],
                Team2: match.team2,
                Legs2: match[`legs_${match.team2}`],
                Gespielt: match.played ? "Ja" : "Nein"
            });
        }
    );

    const sheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        sheetName
    );
}

function getTableOrder(teams) {
    const sortedTeams = Object.values(teams).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.own_score !== a.own_score) return a.own_score - b.own_score;
        return b.opponent_score - a.opponent_score;
    });
    return sortedTeams;
}

export async function exportTournamentResults(tournamentId, tournamentStatus) {
    const statusMapper = {
        group: 0,
        qf: 1,
        sf: 2,
        final: 3,
        finished: 4
    }

    const teams = await getAllTeams(tournamentId);
    const matchdays = await getAllMatchdays(tournamentId);
    const quarterfinals = await getKnockout(tournamentId, "quarterfinals");
    const semifinals = await getKnockout(tournamentId, "semifinals");
    const finals = await getKnockout(tournamentId, "final");

    const workbook = XLSX.utils.book_new();

    if(tournamentStatus == "finished") { 
        // Abschlussplatzierungen
        const standingsSheet = XLSX.utils.json_to_sheet(
            Object.entries(teams)
                .sort(([i1, t1], [i2, t2]) => t1.finalRank - t2.finalRank)
                .map(([teamID, team]) => ({
                    Team: team.name,
                    FinalePlatzierung: team.finalRank
                }))
        );

        XLSX.utils.book_append_sheet(
            workbook,
            standingsSheet,
            "Platzierungen"
        );
    }

    // Teams
    const teamsSheet = XLSX.utils.json_to_sheet(
        Object.entries(teams)
            .map(([teamID, team]) => ({
                Team: team.name
            }))
    );

    XLSX.utils.book_append_sheet(
        workbook,
        teamsSheet,
        "Teams"
    );

    if(statusMapper[tournamentStatus] >= statusMapper["group"]) {
        // Vorrunde
        const preliminaryRows = [];

        Object.entries(matchdays).forEach(([matchdayId, matches]) => {
            Object.entries(matches["matches"]).forEach(([matchId, match]) => {
                preliminaryRows.push({
                    Spieltag: Number(matchdayId) + 1,
                    Team1: match.team1,
                    Punkte1: match[`score_${match.team1}`],
                    Team2: match.team2,
                    Punkte2: match[`score_${match.team2}`],
                    Gespielt: match.played ? "Ja" : "Nein"
                });
            });
        });

        const preliminarySheet =
            XLSX.utils.json_to_sheet(preliminaryRows);

        XLSX.utils.book_append_sheet(
            workbook,
            preliminarySheet,
            "Vorrunde_Ergebnisse"
        );

        // Abschlussplatzierungen Vorrunde
        const standingsPreliminarySheet = XLSX.utils.json_to_sheet(
            getTableOrder(teams)
                .map((team, index) => ({
                    Platzierung: index + 1,
                    Team: team.name,
                    Siege: team.wins,
                    Niederlagen: team.losses,
                    PunkteVerhältnis: `${team.own_score}:${team.opponent_score}`
                }))
        );

        XLSX.utils.book_append_sheet(
            workbook,
            standingsPreliminarySheet,
            "Vorrunde_Tabelle"
        );
    }

    if(statusMapper[tournamentStatus] >= statusMapper["qf"]) {
        // Viertelfinale
        appendKORound(
            workbook,
            "Viertelfinale",
            quarterfinals
        );
    }

    if(statusMapper[tournamentStatus] >= statusMapper["sf"]) {
        // Halbfinale
        appendKORound(
            workbook,
            "Halbfinale",
            semifinals
        );
    }

    if(statusMapper[tournamentStatus] >= statusMapper["final"]) {
        // Finale
        appendKORound(
            workbook,
            "Finale",
            finals
        );
    }

    XLSX.writeFile(
        workbook,
        `${tournamentId}_Ergebnisse.xlsx`
    );
}