// Einmaliges Migrationsskript: kopiert `pinHash` aus tournaments/{id} nach
// tournaments/{id}/private/pin.hash, bevor die neuen Firestore-Rules deployt werden.
//
// Voraussetzung: firebase-admin ist installiert (npm install --save-dev firebase-admin)
// und ein Service-Account-Key liegt lokal vor (NICHT committen, siehe .gitignore).
//
// Aufruf: node scripts/migratePinHash.js ./serviceAccountKey.json

const admin = require("firebase-admin");

const keyPath = process.argv[2];
if (!keyPath) {
    console.error("Nutzung: node scripts/migratePinHash.js <pfad-zum-service-account-key.json>");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(require("path").resolve(keyPath)))
});

const db = admin.firestore();

async function migrate() {
    const tournamentsSnap = await db.collection("tournaments").get();
    console.log(`${tournamentsSnap.size} Turnier(e) gefunden.`);

    let migrated = 0;
    let skipped = 0;

    for (const tournamentDoc of tournamentsSnap.docs) {
        const data = tournamentDoc.data();
        if (!data.pinHash) {
            console.log(`- ${tournamentDoc.id}: kein pinHash vorhanden, übersprungen.`);
            skipped++;
            continue;
        }

        const pinRef = tournamentDoc.ref.collection("private").doc("pin");
        const pinSnap = await pinRef.get();
        if (pinSnap.exists) {
            console.log(`- ${tournamentDoc.id}: private/pin existiert bereits, übersprungen.`);
            skipped++;
            continue;
        }

        await pinRef.set({ hash: data.pinHash });
        console.log(`- ${tournamentDoc.id}: private/pin.hash gesetzt.`);
        migrated++;
    }

    console.log(`Fertig. Migriert: ${migrated}, übersprungen: ${skipped}.`);
    console.log("Hinweis: pinHash-Feld auf den Root-Dokumenten wurde NICHT entfernt (optionales Folgeskript).");
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
