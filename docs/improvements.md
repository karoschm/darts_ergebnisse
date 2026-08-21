# Projekt-Review & Verbesserungsplan

Stand: 2026-08-21. Ergebnis einer Codebase-Analyse (Architektur, Tests, Fehlerbehandlung, Performance, Feature-Umfang) plus eines mit dem Projektinhaber abgestimmten Umsetzungsplans für ein Feature-Paket.

## 1. Bestandsaufnahme

### 1.1 Architektur

- **Kein zentraler Tournament-State**: Teams/Matches/Status werden in fast jeder Komponente einzeln per `useState` + eigenem `onSnapshot` gehalten (z.B. `Preliminary.js`, `KORoundTab.js`, `Running.js`) — dieselben Daten werden mehrfach parallel abonniert statt über einen gemeinsamen Context.
- **Toter Code, der zur Laufzeit crashen würde**: `QuarterfinalTab.js` und `SemifinalTab.js` rufen `generateSemifinals` auf — eine Funktion, die es in `firestoreService.js` nicht mehr gibt. Werden aktuell nirgends importiert.
- **`EditContext`** (`src/context/editContext.js`) ist komplett unbenutzt (definiert, nie gemountet).
- **Export vermutlich kaputt**: `exportService.js` greift mit alten Stage-Namen (`"quarterfinals"`, `"semifinals"`) auf Firestore zu, das aktuelle Schema nutzt aber `round_${roundIndex}`.
- **Kein echtes Firebase Auth** — PIN-System (4-stellig, SHA-256) schützt nur die UI. Die tatsächlichen Firestore Security Rules prüfen nur, *ob* ein `pinHash` existiert, nicht ob er zum eingegebenen PIN passt.
- **Inkonsistente Stage-Namen**: `LoadTournamentSetup.js` definiert eine eigene, veraltete `statusToStage`-Map, abweichend von `firestoreService.js`. Bricht bereits heute bei `koRounds > 3`.
- **Große Komponenten**: `KORoundTab.js` (~510 Zeilen) mit dupliziertem Mobile-/Desktop-Rendering-Pfad, ähnliches Muster in `MatchdayTabs.js`.

### 1.2 Sicherheitslücke (kritisch)

Die aktuellen Firestore-Rules:

```
allow delete: if true;   // jeder kann jedes Turnier löschen, ohne PIN
allow write, delete: if get(...).data.pinHash != null;  // prüft nur Existenz, nicht Korrektheit des PIN
```

Da `pinHash` zusätzlich per `getDoc` öffentlich lesbar ist (der Client vergleicht den PIN aktuell im Browser), kann jeder mit der Turnier-ID:
- den Hash auslesen und offline brute-forcen (nur 10.000 Kombinationen bei 4-stelligem PIN),
- oder direkt ganz ohne PIN schreiben/löschen, da die Rule nur Existenz prüft.

### 1.3 Tests

Praktisch nicht vorhanden — die einzige Testdatei ist unverändertes CRA-Boilerplate (`App.test.js`), das vermutlich sogar fehlschlägt. Die Kernlogik in `firestoreService.js` (Ranglisten, KO-Baum, Score-Berechnung) ist komplett ungetestet.

### 1.4 Fehlerbehandlung

- Keine React Error Boundaries im gesamten Projekt.
- Nur 2 `try/catch`-Stellen im ganzen Code.
- Score-Updates sind "fire-and-forget" ohne Fehlerbehandlung — UI zeigt optimistisch einen Wert, der bei Schreibfehler nie persistiert wird.
- Score-Writes sind Read-Modify-Write ohne Transaktion → bei gleichzeitiger Eingabe von zwei Geräten drohen Lost Updates (bestätigt real relevant, da im Turnierbetrieb mehrere Geräte gleichzeitig schreiben).
- Uneinheitliche/fehlende Ladezustände in den zentralen Turnier-Ansichten.

### 1.5 Performance

- Kaum Memoization (`useMemo`/`useCallback` fast nirgends genutzt).
- Tabellen-Sortierung wird bei jedem Render neu berechnet statt gecacht.
- Mehrere redundante `onSnapshot`-Abos pro Ansicht auf dieselben Daten.
- Kein Code-Splitting (alle Routen statisch importiert), `xlsx` und Firebase-SDK landen komplett im Hauptbundle.
- Bei aktuellen Turniergrößen vermutlich unkritisch, aber unnötig.

### 1.6 Feature-Umfang (Ist-Zustand)

Turnier-Setup/Laden, Team-Verwaltung, Vorrunde mit Round-Robin (eine Gruppe), KO-Runde (dynamisch je nach `koRounds`), Abschlusstabelle/Podium, Excel-Export, PIN-geschützter Editier-Modus, Dark/Light Theme, responsives Layout.

Fehlend: turnierübergreifende Statistik/Historie, Undo für Score-Eingaben, PDF/Print-Export, Mehrsprachigkeit, echte Konflikterkennung bei gleichzeitiger Bearbeitung, Direkt-KO ohne Vorrunde, mehrere Gruppen in der Vorrunde, Leg-basiertes Scoring in der Vorrunde.

---

## 2. Abgestimmtes Feature-Paket

Mit dem Projektinhaber wurden folgende Prioritäten und Design-Entscheidungen festgelegt:

- **Sicherheitsfix** ohne Cloud Functions/Blaze-Plan (Spark/Gratisplan bleibt), PIN bewusst weiterhin 4-stellig.
- **Konflikterkennung** bei gleichzeitiger Eingabe (mehrere Geräte schreiben live).
- **Direkt-KO-Modus** ohne Vorrunde, mit Wahl zwischen zufälliger Auslosung und manueller Setzliste.
- **Mehrere Gruppen** in der Vorrunde, beste N Teams je Gruppe qualifizieren sich für die KO-Runde.
- **Gewinnlegs-Modus** in der Vorrunde als Alternative zum bisherigen Score-Modus (pro Turnier wählbar, analog zum bereits bestehenden Leg-Scoring der KO-Runde).
- **PDF/Print-Export** zusätzlich zum bestehenden (zu reparierenden) Excel-Export.
- Alles in einem Gesamtpaket, phasenweise abzuarbeiten.

---

## 3. Umsetzungsplan

### Reihenfolge & Begründung

```
Phase 0  Aufräumen (toter Code, Bugfixes, die sonst mit neuen Features kollidieren) ✅ Umgesetzt (2026-08-21)
Phase 1  Security-Fix (Anonymous Auth + Firestore Rules + blinder PIN-Check) ✅ Umgesetzt (2026-08-21)
Phase 2  Transaktionen + Konflikt-UX (baut auf den neuen Rules aus Phase 1 auf)
Phase 3a Leg-Modus für die Vorrunde
Phase 3b Direkt-KO-Modus ohne Vorrunde
Phase 3c Mehrere Gruppen in der Vorrunde
Phase 4  PDF/Print-Export + Excel-Export-Bugfix/Erweiterung
```

Phase 1 und 2 fassen dieselben Schreibpfade an (`saveScore`, `saveKOScore`, `deleteTournament`) — die transaktionale Umsetzung in Phase 2 muss gegen die *neuen* Rules aus Phase 1 entwickelt werden, sonst doppelte Testarbeit. Phase 3 verändert das Datenmodell (Gruppen, Leg-Felder in der Vorrunde, KO ohne Vorrunde) und steht vor Phase 4, damit der Export nur einmal gegen den finalen Zustand gebaut wird. Innerhalb Phase 3: 3a zuerst (isolierteste Änderung), 3b danach (in sich geschlossene State-Machine-Erweiterung), 3c zuletzt (größter Eingriff ins Datenmodell).

### Phase 0 – Aufräumen ✅ Umgesetzt (2026-08-21)

**Löschen** (verifiziert: nirgends importiert/gemountet):
- `src/components/Running/KOStage/QuarterfinalTab.js`
- `src/components/Running/KOStage/SemifinalTab.js`
- `src/context/editContext.js`

**Fixen:**
- `LoadTournamentSetup.js` — lokale `statusToStage`-Map entfernen, stattdessen aus `firestoreService.js` importieren.

**Verifikation:** `npm run build`, manuelles Laden eines Turniers mit `koRounds >= 4`.

### Phase 1 – Security-Fix (Anonymous Auth + blinder PIN-Check) ✅ Umgesetzt (2026-08-21)

**Kernidee:** `pinHash` verschwindet aus dem öffentlich lesbaren `tournaments/{id}`-Dokument. Firebase Anonymous Auth (kostenlos, Spark-kompatibel) liefert eine stabile `request.auth.uid` pro Browser-Session.

```
tournaments/{id}/private/pin              { hash: <sha256(pin+id)> }   // allow read: if false
tournaments/{id}/authorizedEditors/{uid}  { grantedAt: <timestamp> }   // Existenz = Schreibrecht
```

Client versucht `setDoc(authorizedEditors/{uid}, { pinHashAttempt: hash })`. Die Rule vergleicht `request.resource.data.pinHashAttempt` serverseitig per `get()` gegen `private/pin` — der Client erfährt nie den echten Hash, nur ob der Write erfolgreich war (`permission-denied` bei falschem PIN). Alle Schreib-/Löschregeln auf Teams/Matches/KO/Tournament-Root prüfen fortan `exists(.../authorizedEditors/$(request.auth.uid))`.

**Entwurf `firestore.rules` (neu im Repo):**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow create: if request.auth != null && !("pinHash" in request.resource.data);
      allow update, delete: if exists(/databases/$(database)/documents/tournaments/$(tournamentId)/authorizedEditors/$(request.auth.uid));

      match /private/pin {
        allow read: if false;
        allow create: if request.auth != null
                      && request.resource.data.hash is string
                      && request.resource.data.hash.size() == 64;
        allow update, delete: if false; // PIN-Änderung: out of scope
      }

      match /authorizedEditors/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow create: if request.auth != null && request.auth.uid == uid
                      && request.resource.data.pinHashAttempt ==
                         get(/databases/$(database)/documents/tournaments/$(tournamentId)/private/pin).data.hash;
        allow delete: if exists(/databases/$(database)/documents/tournaments/$(tournamentId)/authorizedEditors/$(request.auth.uid));
        allow update: if false;
      }

      match /{subcollection}/{docId} {
        allow read: if true;
        allow write, delete: if exists(/databases/$(database)/documents/tournaments/$(tournamentId)/authorizedEditors/$(request.auth.uid));
      }
    }
  }
}
```

**Bekanntes Restrisiko (dokumentiert, nicht blockierend):** 4-stelliger PIN = 10.000 Kombinationen. Anonymous Auth ist kostenlos/unlimitiert, ein Skript könnte alle Kombinationen innerhalb des Spark-Kontingents brute-forcen — ohne Cloud Functions gibt es kein serverseitiges Rate-Limiting. Optionale spätere Härtung: `attemptCount`/`lockedUntil`-Felder in `private/pin`, rein Rule-basiert.

**Migration bestehender Turniere:**
1. Einmaliges lokales Node-Skript `scripts/migratePinHash.js` (firebase-admin, Service-Account-Key **nicht committen**) kopiert `pinHash` → `private/pin.hash` für alle bestehenden Turniere.
2. Danach `firestore.rules` deployen.
3. Optional: `pinHash`-Feld aus Root-Dokumenten per Folgeskript entfernen.

**Zu ändernde Dateien:**

| Datei | Änderung |
|---|---|
| `firestore.rules` (neu) | siehe oben |
| `firebase.json` | `"firestore": { "rules": "firestore.rules" }` ergänzen |
| `scripts/migratePinHash.js` (neu) | einmaliges Admin-SDK-Migrationsskript |
| `src/firebase.js` | `getAuth`, `signInAnonymously` importieren, `export const auth` |
| `src/context/AuthContext.js` (neu) | `AuthProvider`, ruft `signInAnonymously` beim Mount, `onAuthStateChanged` |
| `src/AppRoutes.js` / `src/index.js` | App mit `AuthProvider` umschließen, Ladeindikator bis `authReady` |
| `src/services/firestoreService.js` | `verifyPin` → `verifyPinAndUnlock`; `addTournament` schreibt Hash nach `private/pin`, legt `authorizedEditors/{creatorUid}` an; `deleteTournament` erweitert um `private`, `authorizedEditors` |
| `src/hooks/useTournamentAuth.js` | bleibt UI-Cache (sessionStorage) |
| `src/components/PinDialog.js` | `verifyPin` → `verifyPinAndUnlock` |
| `src/components/Setup/NewTournamentSetup.js` | wartet auf `authReady` vor `addTournament` |
| `src/routes/RequireTournament.js` | wartet auf `authReady` vor `isUnlocked()`-Auswertung |
| `package.json` | devDependency `firebase-tools`, `@firebase/rules-unit-testing` |

**Nicht im Scope:** PIN-Änderung nach Erstellung, echte Nutzerkonten, Rate-Limiting.

**Verifikation:** Firestore Emulator + `@firebase/rules-unit-testing` für Rule-Tests; manuell: Turnier anlegen → PIN in Firestore-Konsole prüfen (nicht mehr auf Root sichtbar) → ohne Freischaltung Speichern versuchen (muss scheitern) → mit PIN entsperren → Speichern funktioniert. Migrationsskript zuerst gegen Testdaten.

### Phase 2 – Konflikterkennung (Transaktionen + Dirty-State-UI)

**2.1 Transaktionale Writes:** ✅ Umgesetzt (2026-08-21). `saveScore`, `saveKOScore`, `addTeamGame` von Read-Modify-Write auf `runTransaction()` umgestellt. Gemeinsamer Helper `computeTeamStats` extrahiert (wird in Phase 3a wiederverwendet). `updateAllKOsPlayed` auf `writeBatch` umgestellt.

**2.2 MatchdayTabs.js / KORoundTab.js – Save-per-Keystroke-Bug:** ✅ Teilweise umgesetzt (2026-08-21). Bug gefunden (nicht nur in `MatchdayTabs.js`, auch in `KORoundTab.js`): `onChange` löste bei jedem Tastendruck/Pfeiltasten-Klick direkt einen `saveScore`/`saveKOScore`-Aufruf aus (Desktop-Vorrunde sogar doppelt, da zusätzlich `onBlur` speicherte). Bei schnellen Eingaben (z.B. "99" tippen oder Pfeiltasten spammen) überholten sich die parallelen Firestore-Transaktionen, wodurch der Score sichtbar zurücksprang und teils ein unbehandelter `FirebaseError` ("stored version does not match required base version") den Browser erreichte. Fix: `onChange` aktualisiert nur noch lokalen State, `saveScore`/`saveKOScore` wird ausschließlich bei `onBlur` aufgerufen (Mobile-Ansicht dafür auf das Onblur-Muster umgestellt, in `KORoundTab.js` neuer `onScoreBlur`-Prop durch `MobileMatchCard`/`DesktopMatchRow` durchgereicht).

Noch offen aus der ursprünglichen Phase 2.2: `subscribeMatchday`/`subscribeKnockoutRound` überschreiben weiterhin den kompletten lokalen State bei jedem Snapshot; ein echtes dirty-Flag pro Feld (behält lokalen Wert beim Snapshot-Merge, auch über das Blur-Save hinaus) ist noch nicht umgesetzt — siehe 2.3.

**2.3 KORoundTab.js – gemeinsamer Hook:** Neuer Hook `src/hooks/useDirtyField.js` (lokaler Wert, Dirty-Flag, Commit, Merge-Regel), gemeinsam genutzt in `MatchdayTabs.js` und `KORoundTab.js`. Zusatzfund: `winLegs` in `KORoundTab.js` ist reiner lokaler State, nicht persistiert — als Tournament-Feld persistieren (dasselbe Feld wie in Phase 3a).

**2.4 Optionales "wird gerade bearbeitet"-Signal:** Best-Effort-Presence via `editingBy`/`editingAt`-Feldern, nice-to-have, nicht blockierend.

**Nicht im Scope:** Undo/Redo, automatische 3-Wege-Konfliktauflösung, robuste Presence.

**Verifikation:** Emulator-Test für parallele Transaktionen; manuell zwei Geräte/Tabs gleichzeitig auf demselben Matchday; `react-scripts test` für `useDirtyField`.

### Phase 3a – Leg-Modus für die Vorrunde

- `tournaments/{id}`: neue Felder `preliminaryScoreMode: "points" | "legs"` (Default `"points"`), `winLegs: number`.
- Bei `"legs"`: Matches bekommen `legs_<team>`-Felder statt `score_<team>` (identisch zum bestehenden KO-Schema).
- `NewTournamentSetup.js`: Auswahl Punktemodus + Gewinnlegs-Feld.
- `firestoreService.js`: `saveSchedule`/`saveScore` modusabhängig.
- `StandingsTable.js` / `exportService.js`: Sortierung ist hart auf "niedrigerer Score gewinnt" codiert — im Legs-Modus gilt das Gegenteil, muss modusabhängig werden.
- Empfehlung: gemeinsame modusfähige Eingabekomponente (`src/components/Running/MatchScoreInput.js`) statt Duplikation.

**Nicht im Scope:** Moduswechsel nach Turniererstellung, gemischte Modi pro Spieltag.

**Verifikation:** Turnier im Legs-Modus durchspielen, Tabellensortierung prüfen.

### Phase 3b – Direkt-KO-Modus ohne Vorrunde

- `tournaments/{id}`: `mode: "roundrobin" | "directko"`, bei `directko`: `seeding: "random" | "manual"`.
- `nextStatus`/`statusToStage` erweitert um `mode`-Parameter, überspringen bei `directko` den `"group"`-Status.
- Neue Zwischenkomponente `src/components/Setup/DirectKOSeeding.js` (nach `TeamSetup.js`, da Teamnamen erst dort feststehen) für manuelles Seeding; bei `"random"` automatisches Mischen analog `shuffleSchedule`.
- Neue Funktion `generateFirstKORoundFromSeed(tournamentID, seededTeamIds, koRounds, hasThirdPlace)`, nutzt bestehendes `generateKORound`.
- `Running.js`: kein "Vorrunde"-Tab bei `directko`.
- v1-Eingrenzung: nur Teamanzahlen als exakte Zweierpotenzen (2/4/8/16/32/64); Freilose nicht im Scope.

**Verifikation:** Turnier mit `directko`+`random` und `directko`+`manual` durchspielen.

### Phase 3c – Mehrere Gruppen in der Vorrunde

Größter Eingriff, bewusst zuletzt.

- `tournaments/{id}`: `groupCount`, `qualifiersPerGroup`. Validierung: `groupCount * qualifiersPerGroup === 2^koRounds`, `teamCount % groupCount === 0` (gleich große Gruppen, v1-Vereinfachung).
- `teams/{teamId}`: neues Feld `group` (Zuweisung in `TeamSetup.js`).
- Matches bekommen `group`-Tag.
- `Preliminary.js`: Spielplan-Generierung läuft pro Gruppe separat.
- `StandingsTable.js`: eine Tabelle pro Gruppe.
- `generateFirstKORound` erweitert: pro Gruppe Top-N ermitteln, einfaches Interleaving zu einer Seed-Liste.
- Direkt-KO (3b) und Gruppen (3c) schließen sich gegenseitig aus.

**Nicht im Scope:** ungleich große Gruppen, zusätzliche Tiebreak-Regeln, ausgefeiltes Cross-Gruppen-Seeding.

**Verifikation:** 8 Teams / 2 Gruppen à 4 / `qualifiersPerGroup=2` durchspielen.

### Phase 4 – PDF/Print-Export + Excel-Fix

**Ansatz: CSS-Print** (`@media print` + `window.print()`) statt Client-PDF-Lib — keine neue Abhängigkeit, nutzt dieselben React-Komponenten, geringerer Wartungsaufwand.

- Neue Route `/tournament/:tournamentId/print` außerhalb der `TournamentLayout`-Chrome.
- Neue Komponente `src/components/Print/TournamentPrintView.js`: lädt Daten read-only, rendert Druckansicht, triggert `window.print()`.
- Neues `src/print.css`: A4-Format, erzwungenes Hell-Theme, `break-inside: avoid`.
- Button in `Running.js`/`FinalStandings.js` navigiert zur Print-Route.

**Excel-Fix (`exportService.js`):**
- Bugfix: veraltete Stage-Namen durch Schleife über `koStageKey(r)` ersetzen.
- Gruppen-aware, Legs-aware, Direkt-KO-aware (siehe jeweilige Phasen).

**Nicht im Scope:** serverseitige PDF-Generierung, pixelgenaues Custom-Layout, E-Mail-Versand.

**Verifikation:** Turnier mit Gruppen + Legs-Modus + Platz-3-Spiel durchspielen, Excel-Inhalt prüfen; Druckansicht als PDF speichern testen.

### Übergreifende Test-/Verifikationsstrategie

1. **`react-scripts test`**: Unit-Tests für reine Logik (`nextStatus`, `statusToStage`, Sortierlogik, `useDirtyField`) und kritische UI-Zustände.
2. **Firestore Emulator** + `@firebase/rules-unit-testing`: Rule-Tests für Phase 1, Transaktionstests für Phase 2.
3. **Manuelles Durchklicken** als Abschlussschritt jeder Phase.
4. Reihenfolge je Phase: Emulator-/Unit-Tests → manuelles Testen gegen Dev-Firebase-Projekt → erst danach `firestore.rules`-Deploy gegen Produktion (separat vom Code-Deploy).

### Kritische Dateien

- `src/services/firestoreService.js`
- `firestore.rules` (neu)
- `src/components/Running/Preliminary/MatchdayTabs.js`
- `src/components/Running/KOStage/KORoundTab.js`
- `src/components/Setup/NewTournamentSetup.js`
- `src/services/exportService.js`
- `src/routes/RequireTournament.js`
