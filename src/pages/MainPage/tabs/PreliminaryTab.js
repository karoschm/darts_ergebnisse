import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useState } from "react"
import { addTeamGame, saveSchedule } from "../../../services/firestoreService";
import GameDayView from "../../../components/GameDayView";
import TableView from "../../../components/TableView";

export default function PreliminaryTab({ teamNames }) {
    const [preliminaryTabValue, setPreliminaryTabValue] = useState(0);
    // const [numberGamedays, setNumberGamedays] = useState(8);

    const handlePreliminaryTabChange = (event, newTabValue) => {
        setPreliminaryTabValue(newTabValue);
    }

    function generateSchedule() {
        function shuffleArray(array) {
            const arr = [...array];
            for (let i = arr.length - 1; i >0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function generateAllMatches(teamNames) {
            const matches = [];
            for (let i = 0; i < teamNames.length; i++) {
                for (let j = i + 1; j < teamNames.length; j++) {
                    matches.push([teamNames[i], teamNames[j]]);
                }
            }
            return matches;
        }

        const allMatches = shuffleArray(generateAllMatches(Object.entries(teamNames).map(([key, value]) => key)))
        const schedule = [];

        for (let day = 0; day < 8; day++) {
            const dayMatches = [];
            const teamsPlayingToday = new Set();

            for (let i = 0; i < allMatches.length && dayMatches.length < 20; i++) {
                const [t1, t2] = allMatches[i];

                if (!teamsPlayingToday.has(t1) && !teamsPlayingToday.has(t2)) {
                    dayMatches.push([t1, t2]);
                    teamsPlayingToday.add(t1);
                    teamsPlayingToday.add(t2);

                    allMatches.splice(i, 1);
                    i--;
                }
            }

            schedule.push(dayMatches)
        }

        return schedule;
    }

    const handleMakeSchedule = () => {
        const newSchedule = generateSchedule();
        saveSchedule(newSchedule);
        newSchedule.map((value, gameday) => {
            value.map(([team1, team2]) => {
                addTeamGame(team1, team2, gameday);
            });
        });
    }

    return (
        <div>
            <h3>
                Vorrunde
            </h3>
            {/* <label>
                Anzahl Spieltage: 
            </label>
            <input 
                type="number"
                value={numberGamedays}
                onChange={e => setNumberGamedays(Number(e.target.value))}
                min={1}
                max={39}
                step={1}
            /> */}
            <button
                onClick={handleMakeSchedule}
            >
                Spielplan generieren
            </button>
            <Tabs
                value={preliminaryTabValue}
                onChange={handlePreliminaryTabChange}
                variant="fullWidth"
            >
                <Tab label="Tabelle" value={0} />
                {[1, 2, 3, 4, 5, 6, 7, 8].map(idx => (
                    <Tab label={idx} value={idx} />
                ))}
            </Tabs>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(day => (
                <div
                    key={day}
                    role="tabpanel"
                    hidden={preliminaryTabValue !== day}
                >
                    {preliminaryTabValue === day && (
                        day === 0 ? (
                            <TableView teamNames={teamNames}/>
                        ) : (
                            <GameDayView gameday={String(day)} teamNames={teamNames}/>
                        )
                    )}
                </div>
            ))
            }
        </div>
    );
}