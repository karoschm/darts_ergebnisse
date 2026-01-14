import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useState } from "react";
import TeamsTab from "./tabs/TeamsTab";
import ScheduleTab from "./tabs/ScheduleTab";

export default function MainPage() {
    const [mainPageTabValue, setMainPageTabValue] = useState(0);

    const handleMainPageTabChange = (event, newTabValue) => {
        setMainPageTabValue(newTabValue);
    }

    return (
        <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 20px"
        }}
        >
            <h1>
                Darts-Turnierplan
            </h1>
            <Tabs
                value={mainPageTabValue}
                onChange={handleMainPageTabChange}
                variant="fullWidth"
            >
                <Tab label={"Teams eintragen"} />
                <Tab label={"Spielplan"} />
            </Tabs>
            {mainPageTabValue === 0 && (
                <>
                    <TeamsTab />
                </>
            )}
            {mainPageTabValue === 1 && (
                <>
                    <ScheduleTab />
                </>
            )

            }
        </div>
    )
}