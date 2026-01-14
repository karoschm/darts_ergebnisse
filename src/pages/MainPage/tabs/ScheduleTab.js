import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useEffect, useState } from "react";
import PreliminaryTab from "./PreliminaryTab";
import { getAllTeams } from "../../../services/firestoreService";

export default function ScheduleTab() {
    const [scheduleTabValue, setScheduleTabValue] = useState(0);
    const [teams, setTeams] = useState([]);
    const [teamNames, setTeamNames] = useState({});

    useEffect(() => {
        async function fetchData() {
            const loadedTeams = await getAllTeams();
            setTeams(loadedTeams);

            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);
        }
        fetchData();
    }, []);

    const handleScheduleTabChange = (event, newTabValue) => {
        setScheduleTabValue(newTabValue);
    }

    return (
        <div>
            <h2>
                Spielplan
            </h2>
            <Tabs
                value={scheduleTabValue}
                onChange={handleScheduleTabChange}
                variant="fullWidth"
            >
                <Tab label={"Vorrunde"} />
                <Tab label={"Viertelfinale"} />
                <Tab label={"Halbfinale"} />
                <Tab label={"Finale"} />
            </Tabs>
            {scheduleTabValue === 0 && (
                <>
                    <PreliminaryTab teamNames={teamNames} />
                </>
            )}
        </div>
    )
}