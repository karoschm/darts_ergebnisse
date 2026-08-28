import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getTournamentData, getAllTeams, getAllMatchdays, getKnockout,
    koStageKey, koRoundLabel, groupLabel, loserStageKey, loserRoundLabel,
    getLbSchedule, GRAND_FINAL_STAGE, GRAND_FINAL_RESET_STAGE
} from "../../services/firestoreService";
import "../../print.css";

function sortTeams(teams, scoreMode) {
    return teams
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
}

function KORoundTable({ title, matches }) {
    const entries = Object.entries(matches || {});
    if (entries.length === 0) return null;
    return (
        <div className="print-subsection">
            <h3>{title}</h3>
            <table className="print-table">
                <thead>
                    <tr><th>Spiel</th><th>Team 1</th><th>Team 2</th><th>Ergebnis</th></tr>
                </thead>
                <tbody>
                    {entries.map(([key, m]) => (
                        <tr key={key}>
                            <td>{key}</td>
                            <td>{m.team1}</td>
                            <td>{m.team2}</td>
                            <td>
                                {m.isByeMatch
                                    ? "Freilos"
                                    : `${m[`legs_${m.team1}`]} : ${m[`legs_${m.team2}`]}`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function TournamentPrintView() {
    const { tournamentId } = useParams();

    const [loading, setLoading] = useState(true);
    const [tournamentData, setTournamentData] = useState(null);
    const [teams, setTeams] = useState([]);
    const [matchdays, setMatchdays] = useState([]);
    const [wbRounds, setWbRounds] = useState([]);
    const [lbRounds, setLbRounds] = useState([]);
    const [gfRounds, setGfRounds] = useState([]);

    useEffect(() => {
        async function load() {
            const data = await getTournamentData(tournamentId);
            if (!data) { setLoading(false); return; }
            setTournamentData(data);

            const koRounds = data.koRounds ?? 0;
            const mode = data.mode ?? "roundrobin";
            const koFormat = data.koFormat ?? "single";
            const bracketReset = data.bracketReset ?? false;

            const allTeams = await getAllTeams(tournamentId);
            setTeams(allTeams);

            if (mode !== "directko") {
                const mds = await getAllMatchdays(tournamentId);
                setMatchdays(mds.sort((a, b) => Number(a.id) - Number(b.id)));
            }

            const wb = [];
            for (let r = 1; r <= koRounds; r++) {
                const roundData = await getKnockout(tournamentId, koStageKey(r));
                if (roundData.matches) wb.push({ key: koStageKey(r), label: koRoundLabel(koRounds, r), matches: roundData.matches });
            }
            setWbRounds(wb);

            if (mode === "directko" && koFormat === "double") {
                const schedule = getLbSchedule(koRounds);
                const lb = [];
                for (let r = 1; r <= schedule.length; r++) {
                    const roundData = await getKnockout(tournamentId, loserStageKey(r));
                    if (roundData.matches) lb.push({ key: loserStageKey(r), label: loserRoundLabel(koRounds, r), matches: roundData.matches });
                }
                setLbRounds(lb);

                const gf = [];
                const gf1 = await getKnockout(tournamentId, GRAND_FINAL_STAGE);
                if (gf1.matches) gf.push({ key: GRAND_FINAL_STAGE, label: "Grand Final", matches: gf1.matches });
                if (bracketReset) {
                    const gf2 = await getKnockout(tournamentId, GRAND_FINAL_RESET_STAGE);
                    if (gf2.matches) gf.push({ key: GRAND_FINAL_RESET_STAGE, label: "Grand Final (Reset)", matches: gf2.matches });
                }
                setGfRounds(gf);
            }

            setLoading(false);
        }
        load();
    }, [tournamentId]);

    if (loading) return <div className="print-loading">Lade Druckansicht...</div>;
    if (!tournamentData) return <div className="print-loading">Turnier nicht gefunden.</div>;

    const scoreMode = tournamentData.preliminaryScoreMode ?? "points";
    const fieldPrefix = scoreMode === "legs" ? "legs" : "score";
    const groupCount = tournamentData.groupCount ?? 1;
    const realTeams = teams.filter(t => !t.isBye);
    const finished = tournamentData.status === "finished";

    const standingsByGroup = Array.from({ length: groupCount }, (_, g) =>
        sortTeams(realTeams.filter(t => (t.group ?? 0) === g), scoreMode)
    );

    const finalStandings = finished
        ? realTeams.slice().sort((a, b) => a.finalRank - b.finalRank)
        : [];

    return (
        <div className="print-page">
            <div className="print-toolbar">
                <button onClick={() => window.print()}>Drucken / Als PDF speichern</button>
            </div>

            <h1>{tournamentId}</h1>

            {finalStandings.length > 0 && (
                <div className="print-section">
                    <h2>Abschließende Platzierungen</h2>
                    <table className="print-table">
                        <thead><tr><th>Platz</th><th>Team</th></tr></thead>
                        <tbody>
                            {finalStandings.map(t => (
                                <tr key={t.id}><td>{t.finalRank}</td><td>{t.name}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="print-section">
                <h2>Teams</h2>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Team</th>
                            {groupCount > 1 && <th>Gruppe</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {realTeams.map(t => (
                            <tr key={t.id}>
                                <td>{t.name}</td>
                                {groupCount > 1 && <td>{groupLabel(t.group ?? 0)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {matchdays.length > 0 && (
                <div className="print-section">
                    <h2>Vorrunde – Spielplan</h2>
                    {matchdays.map(md => (
                        <div key={md.id} className="print-subsection">
                            <h3>Spieltag {Number(md.id)}</h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        {groupCount > 1 && <th>Gruppe</th>}
                                        <th>Team 1</th><th>Team 2</th><th>Ergebnis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(md.matches || {}).map(([key, m]) => (
                                        <tr key={key}>
                                            {groupCount > 1 && <td>{groupLabel(m.group ?? 0)}</td>}
                                            <td>{m.team1}</td>
                                            <td>{m.team2}</td>
                                            <td>
                                                {m.team1 === "BYE" || m.team2 === "BYE"
                                                    ? "Freilos"
                                                    : `${m[`${fieldPrefix}_${m.team1}`]} : ${m[`${fieldPrefix}_${m.team2}`]}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {standingsByGroup.some(g => g.length > 0) && (
                <div className="print-section">
                    <h2>Vorrunde – Tabelle</h2>
                    {standingsByGroup.map((groupTeams, g) => groupTeams.length > 0 && (
                        <div key={g} className="print-subsection">
                            {groupCount > 1 && <h3>Gruppe {groupLabel(g)}</h3>}
                            <table className="print-table">
                                <thead><tr><th>#</th><th>Team</th><th>S</th><th>N</th><th>+/-</th></tr></thead>
                                <tbody>
                                    {groupTeams.map((t, i) => (
                                        <tr key={t.id}>
                                            <td>{i + 1}</td>
                                            <td>{t.name}</td>
                                            <td>{t.wins}</td>
                                            <td>{t.losses}</td>
                                            <td>{t.own_score}:{t.opponent_score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {wbRounds.length > 0 && (
                <div className="print-section">
                    <h2>{gfRounds.length > 0 || lbRounds.length > 0 ? "Gewinner-Bracket" : "KO-Runde"}</h2>
                    {wbRounds.map(r => (
                        <KORoundTable key={r.key} title={r.label} matches={r.matches} />
                    ))}
                </div>
            )}

            {lbRounds.length > 0 && (
                <div className="print-section">
                    <h2>Verlierer-Bracket</h2>
                    {lbRounds.map(r => (
                        <KORoundTable key={r.key} title={r.label} matches={r.matches} />
                    ))}
                </div>
            )}

            {gfRounds.length > 0 && (
                <div className="print-section">
                    <h2>Grand Final</h2>
                    {gfRounds.map(r => (
                        <KORoundTable key={r.key} title={r.label} matches={r.matches} />
                    ))}
                </div>
            )}
        </div>
    );
}
