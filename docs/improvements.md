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
Phase 3d Bugfix + Rangfolge ohne Spiel um Platz 3
Phase 3e Doppel-KO / Loser-Bracket für Direkt-KO
Phase 4  PDF/Print-Export + Excel-Export-Bugfix/Erweiterung
```

Phase 1 und 2 fassen dieselben Schreibpfade an (`saveScore`, `saveKOScore`, `deleteTournament`) — die transaktionale Umsetzung in Phase 2 muss gegen die *neuen* Rules aus Phase 1 entwickelt werden, sonst doppelte Testarbeit. Phase 3 verändert das Datenmodell (Gruppen, Leg-Felder in der Vorrunde, KO ohne Vorrunde) und steht vor Phase 4, damit der Export nur einmal gegen den finalen Zustand gebaut wird. Innerhalb Phase 3: 3a zuerst (isolierteste Änderung), 3b danach (in sich geschlossene State-Machine-Erweiterung), 3c zuletzt (größter Eingriff ins Datenmodell). 3d (Bugfix, seit dem Freilos-Nachtrag zu 3b bekannt) und 3e (Doppel-KO, baut auf dem Direkt-KO-Datenmodell aus 3b/3d auf) kamen nachträglich hinzu und stehen bewusst nach 3a–3c, aber weiterhin vor Phase 4, damit Export/Print gegen den finalen KO-Datenstand gebaut werden.

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

Rest von Phase 2.2 ✅ Umgesetzt (2026-08-21): `subscribeMatchday`/`subscribeKnockoutRound` mergen eingehende Snapshots jetzt pro Feld gegen einen `dirtyFieldsRef` (in `MatchdayTabs.js` und `KORoundTab.js`). Ein lokal geänderter/gespeicherter Wert bleibt erhalten, bis der Server exakt diesen Wert zurückspiegelt — schützt sowohl laufende Eingaben als auch frisch per Blur gespeicherte, aber noch nicht zurückgespiegelte Werte vor dem Überschreiben durch parallele Schreibvorgänge anderer Geräte. Die gemeinsame Extraktion in einen wiederverwendbaren Hook (`useDirtyField.js`) sowie die `winLegs`-Persistierung bleiben Teil von 2.3.

**2.3 KORoundTab.js – gemeinsamer Hook:** ✅ Umgesetzt (2026-08-21). Neuer Hook `src/hooks/useDirtyField.js` (Dirty-Ref, `markDirty`, `mergeSnapshot`), gemeinsam genutzt in `MatchdayTabs.js` und `KORoundTab.js` (ersetzt die dort bisher duplizierte Ref-/Merge-Logik aus 2.2). Zusatzfund behoben: `winLegs` in `KORoundTab.js` war reiner lokaler State (Default 3), nicht persistiert — jetzt als Feld `winLegs` **pro KO-Runden-Dokument** (`tournaments/{id}/knockout/{stageKey}`) persistiert (`updateKOStageWinLegs` in `firestoreService.js`, mitgeliefert von der bereits bestehenden `subscribeKnockoutRound`), inkl. Dirty-Schutz über denselben Hook (Pseudo-Key `"meta"`). Bewusst **pro Runde** statt turnierweit (erste Umsetzung setzte fälschlich ein einzelnes Tournament-Feld ein, wodurch eine Änderung z.B. im Halbfinale auch andere KO-Runden mit überschrieben hätte — korrigiert). Neu generierte Runden (`generateKORound`) starten mit Default `winLegs: 3`.

**2.4 Optionales "wird gerade bearbeitet"-Signal:** ✅ Umgesetzt (2026-08-21). Best-Effort-Presence via `editingBy`/`editingAt`-Feldern pro Match (`setMatchdayEditing`/`clearMatchdayEditing` bzw. `setKOEditing`/`clearKOEditing` in `firestoreService.js`). `onFocus` eines Score-Feldes schreibt `editingBy: <clientId>` + `editingAt: serverTimestamp()` auf das jeweilige Match, `onBlur` löscht beide Felder wieder (zusätzlich zum bestehenden `saveScore`/`saveKOScore`-Aufruf). Andere Clients erkennen dies über den ohnehin laufenden `subscribeMatchday`/`subscribeKnockoutRound`-Snapshot (kein zusätzliches Abo nötig) und zeigen einen Hinweis ("Wird gerade auf einem anderen Gerät bearbeitet …"), sofern `editingBy` einer fremden `clientId` gehört und `editingAt` jünger als 12s ist (Staleness-Schutz, falls ein Client ohne Blur/Unmount-Cleanup verschwindet — Cleanup erfolgt zusätzlich explizit beim Unmount der Komponente).

**Korrektur (2026-08-21):** Erste Umsetzung nutzte fälschlich die Firebase-Anonymous-Auth-`uid` als Identität. Diese gilt aber pro Browser, nicht pro Tab (in IndexedDB persistiert, tab-übergreifend geteilt) — zwei Tabs derselben Person auf demselben Turnier hätten sich so gegenseitig als "sich selbst" erkannt und nie den Hinweis angezeigt. Fix: neuer Hook `src/hooks/useClientId.js` erzeugt eine zufällige `clientId` pro Tab (`sessionStorage`, nicht tab-übergreifend geteilt) und wird statt der `uid` für `editingBy`/den Vergleich verwendet. Bewusst kein echtes Lock, rein informativ — parallele Eingaben bleiben weiterhin über die Transaktionen aus 2.1 und den Dirty-Field-Schutz aus 2.2/2.3 abgesichert. Keine Rule-Änderung nötig, da diese Felder Teil desselben `matchdays`/`knockout`-Dokuments sind und bereits über die bestehende `authorizedEditors`-Prüfung geschützt sind.

**2.5 KORoundTab.js – Flackern von Default-Werten beim Rundenwechsel:** ✅ Umgesetzt (2026-08-21). Root Cause: `Running.js` rendert `KORoundTab` mit `key={roundStage}` — beim Tab-Wechsel wird die Komponente daher komplett neu gemountet, mit frischen Default-States (`roundData = { matches: {} }`, `winLegs = 3`, `status = ""`), bevor die neue `subscribeKnockoutRound`-Subscription den ersten echten Snapshot liefert. Fix: neuer `loading`-State (Default `true`, wird beim ersten Snapshot-Callback von `subscribeKnockoutRound` auf `false` gesetzt); solange `loading === true` rendert die Komponente (Mobile und Desktop identisch) nur einen zentrierten `CircularProgress` statt der Default-Platzhalter/-Gewinnlegs.

**Nicht im Scope:** Undo/Redo, automatische 3-Wege-Konfliktauflösung, robuste Presence.

**Verifikation:** Emulator-Test für parallele Transaktionen; manuell zwei Geräte/Tabs gleichzeitig auf demselben Matchday; `react-scripts test` für `useDirtyField`.

### Phase 3a – Leg-Modus für die Vorrunde ✅ Umgesetzt (2026-08-21)

- `tournaments/{id}`: neue Felder `preliminaryScoreMode: "points" | "legs"` (Default `"points"`), `winLegs: number`.
- Bei `"legs"`: Matches bekommen `legs_<team>`-Felder statt `score_<team>` (identisch zum bestehenden KO-Schema).
- `NewTournamentSetup.js`: Auswahl Punktemodus + Gewinnlegs-Feld.
- `firestoreService.js`: `saveSchedule`/`saveScore` modusabhängig.
- `StandingsTable.js` / `exportService.js`: Sortierung ist hart auf "niedrigerer Score gewinnt" codiert — im Legs-Modus gilt das Gegenteil, muss modusabhängig werden.
- Empfehlung: gemeinsame modusfähige Eingabekomponente (`src/components/Running/MatchScoreInput.js`) statt Duplikation.

**Umsetzung:** `addTournament` speichert `preliminaryScoreMode`/`winLegs` auf dem Turnier-Root-Dokument. `saveSchedule`, `saveScore`, `addTeamGame` und `computeTeamStats` in `firestoreService.js` nehmen jetzt `scoreMode`/`winLegs`-Parameter entgegen und wählen darüber sowohl das Feldpräfix (`score_`/`legs_`) als auch die Sieg-Richtung (niedriger vs. höher gewinnt) und die "played"-Bedingung (Feld gefüllt vs. Gewinnlegs erreicht). `generateFirstKORound` bekommt denselben `scoreMode`-Parameter für den Tie-Break beim Vorrunden-Ranking. `StandingsTable.js` und `exportService.js` sortieren modusabhängig. `Preliminary.js` lädt Modus/Gewinnlegs aus den Turnierdaten und reicht sie an `StandingsTable`/`MatchdayTabs`/die Firestore-Aufrufe durch; `MatchdayTabs.js` nutzt ein lokales `fieldPrefix`/`maxScore` statt hartcodierter `score_`/`501`-Werte. Bewusst **keine** eigene `MatchScoreInput`-Komponente eingeführt (Empfehlung war optional) — die Duplikation in `MatchdayTabs.js` (Mobile/Desktop) blieb unverändert bestehen, nur parametrisiert, um den Diff klein zu halten.

**Nicht im Scope:** Moduswechsel nach Turniererstellung, gemischte Modi pro Spieltag.

**Verifikation:** Turnier im Legs-Modus durchspielen, Tabellensortierung prüfen.

### Phase 3b – Direkt-KO-Modus ohne Vorrunde ✅ Umgesetzt (2026-08-21)

- `tournaments/{id}`: `mode: "roundrobin" | "directko"`, bei `directko`: `seeding: "random" | "manual"`.
- `nextStatus`/`statusToStage` erweitert um `mode`-Parameter, überspringen bei `directko` den `"group"`-Status.
- Neue Zwischenkomponente `src/components/Setup/DirectKOSeeding.js` (nach `TeamSetup.js`, da Teamnamen erst dort feststehen) für manuelles Seeding; bei `"random"` automatisches Mischen analog `shuffleSchedule`.
- Neue Funktion `generateFirstKORoundFromSeed(tournamentID, seededTeamIds, koRounds, hasThirdPlace)`, nutzt bestehendes `generateKORound`.
- `Running.js`: kein "Vorrunde"-Tab bei `directko`.
- v1-Eingrenzung: nur Teamanzahlen als exakte Zweierpotenzen (2/4/8/16/32/64); Freilose nicht im Scope.

**Umsetzung:** `nextStatus`/`statusToStage` (`firestoreService.js`) nehmen jetzt einen optionalen `mode`-Parameter (Default `"roundrobin"`) entgegen; bei Status `"setup"` und `mode === "directko"` wird direkt auf `ko_1`/`round_1` gemappt, ohne über `"group"` zu laufen. `addTournament` speichert `mode` (und bei `directko` zusätzlich `seeding`) auf dem Turnier-Root-Dokument und setzt `matchdays: 0` für Direkt-KO-Turniere. Neue Funktion `generateFirstKORoundFromSeed` setzt `preliminaryRank`/`reachedStage` auf den Teams analog zu `generateFirstKORound`, sortiert aber nicht nach Vorrunden-Ergebnissen, sondern übernimmt die übergebene Setzreihenfolge direkt und ruft damit `generateKORound` auf. `NewTournamentSetup.js` bekommt einen Modus-Umschalter ("Vorrunde + KO-Runde" / "Direkt-KO ohne Vorrunde"); im Direkt-KO-Zweig wird die Teamanzahl über ein auf Zweierpotenzen begrenztes Dropdown gewählt (KO-Runden-Anzahl ergibt sich automatisch daraus, keine Vorrunden-/Wertungsmodus-Felder), zusätzlich eine Setzlisten-Auswahl (Zufällige Auslosung / Manuelle Setzliste). `TeamSetup.js` leitet nach dem Speichern der Teamnamen bei `mode === "directko"` auf eine neue Route `/tournament/{id}/seeding` (in `AppRoutes.js`, ohne `:mode`-Segment wie `/teams`, dadurch von `RequireTournament.js`s Stage-Prüfung ausgenommen) statt auf `/edit/running/preliminary`. Neue Komponente `DirectKOSeeding.js`: bei `"random"` wird beim Laden ein Fisher-Yates-Shuffle der Teams angezeigt (per Button erneut auslosbar), bei `"manual"` eine Liste mit Auf/Ab-Pfeilen zum manuellen Sortieren. "Turnier starten" ruft `generateFirstKORoundFromSeed` auf, setzt den Status per `nextStatus("setup", koRounds, "directko")` und navigiert zu `round_1`. `Running.js` blendet den "Vorrunde"-Tab aus, wenn das geladene Turnier `mode === "directko"` hat (KORoundTab ist bereits rundenagnostisch und benötigt keine Änderung). `RequireTournament.js`s `isValidStage` und `LoadTournamentSetup.js`s Stage-Ermittlung reichen den `mode` jetzt ebenfalls durch, damit Redirects bei Direkt-KO-Turnieren nicht auf `"preliminary"` zeigen.

**Nachtrag (2026-08-21) – Freilose für Nicht-Zweierpotenzen:** Auf Wunsch des Projektinhabers wurde die v1-Eingrenzung aufgehoben; Direkt-KO erlaubt jetzt beliebige Teamanzahlen ab 2. `NewTournamentSetup.js` hat dafür ein freies Zahlenfeld statt des Zweierpotenzen-Dropdowns; die KO-Rundenanzahl wird als `Math.ceil(log2(teamCount))` berechnet (kleinste Bracketgröße, die alle Teams aufnimmt), Differenz zu `teamCount` = Anzahl Freilose. `addTournament`/`createTeams` legen bei Bedarf ein `BYE`-Pseudo-Team an (Parameter `includeByeTeam`, ersetzt die alte, nur an ungerade Vorrunden-Teamzahlen gekoppelte Bedingung). `generateFirstKORoundFromSeed` füllt die Setzliste bis zur Bracketgröße mit `"BYE"`-Einträgen am Ende auf — durch die bestehende Paarungslogik in `generateKORound` (1 vs. letzter Platz, 2 vs. vorletzter, …) bekommen dadurch automatisch die bestplatzierten Teams ein Freilos. Neue interne Funktion `resolveByeMatches` markiert diese Matches direkt nach der Generierung als `played: true` mit `isByeMatch: true` und einem klaren Sieg für das echte Team; `updateAllKOsPlayed` überspringt solche Matches beim Neuberechnen (bleiben immer gewertet, unabhängig von späteren `winLegs`-Änderungen). `KORoundTab.js` zeigt Freilos-Spiele als reinen "[Team] spielfrei"-Hinweis ohne Score-Eingabe (Mobile-Card/Desktop-Tabellenzeile analog zum bestehenden Vorrunden-Muster in `MatchdayTabs.js`) und schließt beim Rundenabschluss das `"BYE"`-Pseudo-Team explizit aus der Verlierer-/Rangfolge-Berechnung aus, damit es nicht fälschlich einen Platz in der nächsten Rundenrangliste belegt (Korrektur eines sonst entstehenden Off-by-one-Fehlers in `finalRank`). `DirectKOSeeding.js` zeigt zusätzlich an, wie viele und welche (bestplatzierten) Teams ein Freilos bekommen.

**Verifikation:** Turnier mit `directko`+`random` und `directko`+`manual` durchspielen; zusätzlich ein Direkt-KO-Turnier mit nicht-Zweierpotenz-Teamanzahl (z.B. 5 oder 6 Teams) durchspielen und prüfen, dass die Freilos-Spiele korrekt automatisch gewertet werden und die Abschlusstabelle stimmt.

### Phase 3c – Mehrere Gruppen in der Vorrunde ✅ Umgesetzt (2026-08-21)

Größter Eingriff, bewusst zuletzt.

- `tournaments/{id}`: `groupCount`, `qualifiersPerGroup`. Validierung: `groupCount * qualifiersPerGroup === 2^koRounds`, `teamCount % groupCount === 0` (gleich große Gruppen, v1-Vereinfachung).
- `teams/{teamId}`: neues Feld `group` (Zuweisung in `TeamSetup.js`).
- Matches bekommen `group`-Tag.
- `Preliminary.js`: Spielplan-Generierung läuft pro Gruppe separat.
- `StandingsTable.js`: eine Tabelle pro Gruppe.
- `generateFirstKORound` erweitert: pro Gruppe Top-N ermitteln, einfaches Interleaving zu einer Seed-Liste.
- Direkt-KO (3b) und Gruppen (3c) schließen sich gegenseitig aus.

**Umsetzung:** `addTournament` speichert `groupCount` (Default 1) sowie, wenn `groupCount > 1`, `qualifiersPerGroup` auf dem Turnier-Root-Dokument; bei `mode === "directko"` wird `groupCount` unabhängig vom übergebenen Wert hart auf 1 erzwungen (gegenseitiger Ausschluss zu 3b). Neue Helper `groupLabel(index)` (`firestoreService.js`) liefert die Anzeige-Bezeichnung ("A", "B", …) aus dem 0-basierten `group`-Index. Neue Funktion `updateTeamGroups` schreibt die Gruppenzuweisung batchweise auf die Team-Dokumente.

`NewTournamentSetup.js` bekommt (nur im Modus "Vorrunde + KO-Runde") ein Feld "Anzahl Gruppen". Validierung beim Absenden (zusätzlich zur bereits im Entwurf genannten Teilbarkeits-Prüfung): jede Gruppe muss eine **gerade** Teamanzahl haben (`(teamCount / groupCount) % 2 === 0`) — bewusste v1-Einschränkung, da sonst pro Gruppe ein eigenes Freilos-Handling nötig wäre (analog zum globalen BYE-Team aus Phase 3b, aber pro Gruppe), was den Eingriff unverhältnismäßig vergrößert hätte. Diese Einschränkung ist nirgends im ursprünglichen Entwurf explizit genannt, ergänzt aber nur die bereits vorgesehene "gleich große Gruppen"-Vereinfachung.

**Korrektur (2026-08-21) — redundante KO-Rundenauswahl entfernt:** Erste Umsetzung fragte bei Gruppen zusätzlich zur bislang schon vorhandenen "KO-Runde beginnen bei"-Auswahl (bestimmt `koRounds`) noch separat "Qualifikanten pro Gruppe" ab und verlangte, dass der Nutzer beide Werte manuell konsistent hält (`groupCount × qualifiersPerGroup === 2^koRounds`) — unnötig redundant, da sich einer der beiden Werte aus dem anderen ergibt. Auf Hinweis des Projektinhabers umgebaut: Bei `groupCount > 1` entfällt die "KO-Runde beginnen bei"-Auswahl vollständig; stattdessen wählt der Nutzer nur noch eine Checkbox "Anschließende KO-Runde" und (falls aktiviert) "Qualifikanten pro Gruppe". Die KO-Rundenanzahl wird daraus berechnet (`koRounds = log2(groupCount × qualifiersPerGroup)`) und live als Readout angezeigt (z.B. "2 Gruppen × 2 Qualifikanten = 4 Teams → Halbfinale"). Ergibt das Produkt keine Zweierpotenz, erscheint ein Warnhinweis statt eines Rechenergebnisses, und der Submit wird mit entsprechender Fehlermeldung blockiert (zusätzlich weiterhin: Qualifikanten/Gruppe darf nicht größer als die Gruppengröße sein). Bei `groupCount === 1` bleibt die klassische "KO-Runde beginnen bei"-Auswahl unverändert bestehen. Betrifft nur `NewTournamentSetup.js` (neuer abgeleiteter Wert `effectiveKoRounds` statt der bisherigen `isDirectKO ? directKoRounds : koRounds`-Fallunterscheidung) — Datenmodell und `firestoreService.js` unverändert, da dort ohnehin schon mit dem fertig berechneten `koRounds`/`qualifiersPerGroup`-Paar gearbeitet wird.

**Bugfix (2026-08-21) — Default-Gruppenzuweisung griff nie, keine Validierung auf Gruppengröße:** Zwei zusammenhängende Probleme, vom Projektinhaber beim ersten Test entdeckt (16 Teams / 4 Gruppen → alle 16 Teams landeten default in Gruppe A). (1) `TeamSetup.js` nutzte `team.group ?? (index % loadedGroupCount)` als Default — `createTeams()` (`firestoreService.js`) setzt aber bereits beim Anlegen `group: 0` auf jedes Team, wodurch `team.group` nie `null`/`undefined` war und die Rundum-Verteilung nie griff. Fix: Default ignoriert `team.group` bewusst und verteilt immer per `index % loadedGroupCount`. (2) Es gab keine Sperre gegen das Starten des Turniers mit ungleich großen Gruppen (z.B. durch manuelles Umsortieren aller Teams in eine Gruppe) — `handleSubmit` in `TeamSetup.js` validiert jetzt vor dem Start, dass jede Gruppe exakt `teamCount / groupCount` Teams enthält, und blockiert mit Fehlermeldung (inkl. Aufschlüsselung der aktuellen Gruppengrößen) andernfalls. Neu: `useFormStatus`-Hook (bereits aus `NewTournamentSetup.js` bekannt) für die Fehleranzeige.

**Bugfix (2026-08-21) — "Qualifikanten pro Gruppe" ohne Obergrenze:** Das Feld hatte kein `max` und ließ beliebige Werte eintippen; die eigentlich zulässige Obergrenze ergibt sich aber daraus, wie viele Teams pro Gruppe eine ganze KO-Runde auffüllen können (Beispiel des Projektinhabers: 14 Teams / 2 Gruppen → 7 Teams/Gruppe → maximal 4 Qualifikanten/Gruppe, da 2×4=8 die nächstkleinere Zweierpotenz ≤14 ist). Fix: neue Helper `maxQualifiersPerGroup(teamsInGroup)` (größte Zweierpotenz ≤ Gruppengröße — muss eine Zweierpotenz sein, da die Gruppenanzahl bereits laut Validierung selbst eine ist) liefert jetzt das `max`-Attribut des Felds; `onChange` kappt zusätzlich aktiv auf diesen Wert (verlässt sich nicht nur auf das HTML-`max`, das manuelles Eintippen größerer Werte nicht zuverlässig verhindert). Neue Funktion `clampQualifiersPerGroup`, aufgerufen bei Team- oder Gruppenanzahl-Änderung, senkt einen zuvor gültigen Wert automatisch ab, falls er durch die Änderung ungültig würde (analog zum bereits bestehenden `clampMatchdays`-Muster). Die bisherigen Submit-Validierungen (`qualifiersPerGroup > teamsPerGroup`, Zweierpotenz-Check) bleiben als zusätzliches Sicherheitsnetz bestehen.

**Erweiterung (2026-08-21) — ungerade Gruppengröße über "Jeder gegen jeden":** Die bisherige Einschränkung "jede Gruppe muss eine gerade Teamanzahl haben" (siehe oben) wird auf Wunsch des Projektinhabers gelockert. Erkenntnis aus der gemeinsamen Analyse: Ein echtes, persistiertes Freilos-Team pro Gruppe ist dafür gar nicht nötig — `"BYE"` wird im gesamten Code (`saveSchedule`, `addTeamGame`, `MatchdayTabs.js`) ohnehin nur als String-Sentinel behandelt, nie als echte Team-Entität mit eigenem Firestore-Dokument (Tabellen-/Statistikberechnung liest `teams/BYE` nirgends; das bestehende globale BYE-Team aus Phase 0/3b existiert nur, weil `Preliminary.js`s bisherige Nicht-Gruppen-Spielplan-Generierung ihre Teamliste direkt aus der abonnierten `teams`-Collection ableitet). Zusätzlich bleibt die relative Gruppentabelle fair, obwohl ein Freilos-Sieg automatisch verbucht wird (`addTeamGame`s bestehende Bye-Logik, unverändert übernommen): da *jedes* Team der Gruppe genau einmal denselben Freilos-Bonus (identische Sieg-/Score-Gutschrift) bekommt, verschiebt sich die Rangfolge dadurch nicht.

Neue Option **"Vorrundenformat"** in `NewTournamentSetup.js`, nur sichtbar bei `groupCount > 1`: "Feste Spieltaganzahl" (bisheriges Verhalten, weiterhin gerade Gruppengröße nötig) vs. "Jeder gegen jeden" (`preliminaryFormat === "full"`, rein clientseitiger UI-Zustand, nicht persistiert). Bei "Jeder gegen jeden" entfällt das Spieltage-Eingabefeld — die Anzahl ergibt sich automatisch aus der Gruppengröße (`teamsPerGroup - 1` bei gerader, `teamsPerGroup` bei ungerader Gruppengröße, dann mit rotierendem Freilos pro Runde) und wird als Info-Text angezeigt; dieser berechnete Wert (`effectiveNumberMatchdays`) wird anstelle der freien Nutzereingabe an `addTournament` übergeben. Die Submit-Validierung "Gruppe muss gerade sein" greift nur noch, wenn `!useFullRoundRobin`.

**Kein neues Datenbank-Feld nötig:** Da "Jeder gegen jeden" nur die Spielplan-*Generierung* zum Erstellungszeitpunkt betrifft (nicht das spätere Laufzeitverhalten), muss der gewählte Modus nicht auf dem Turnier-Dokument persistiert werden — `Preliminary.js`s `generateSchedule()` unterstützt ungerade Gruppengrößen jetzt generell (unabhängig vom gewählten Modus): Hat eine Gruppe eine ungerade Teamanzahl, wird vor dem Aufruf von `generateRoundRobinSchedule` der Literal-String `"BYE"` an die Team-ID-Liste dieser Gruppe angehängt (kein Firestore-Dokument, rein im Spielplan-Array) — der bestehende Rundenplan-Rotationsalgorithmus verteilt das Freilos dadurch automatisch rotierend auf alle Teams der Gruppe, exakt wie bei der bereits bestehenden BYE-Behandlung im Nicht-Gruppen-Fall.

**Nicht im Scope:** gemischte Formate zwischen den Gruppen eines Turniers (alle Gruppen nutzen denselben Modus), Freilos-Anzeige/-Sonderfälle über das bereits bestehende "[Team] spielfrei"-UI-Muster hinaus.

**Bugfix (2026-08-21) — Freilos wurde als Sieg in der Tabelle gewertet:** Vom Projektinhaber entdeckt (Setup 14 Teams / 2 Gruppen à 7, "Jeder gegen jeden"): Die Vorrundentabelle zeigte für Freilos-Spiele einen gewerteten Sieg — erste Korrektur verschob diese Wertung nur zeitlich (erst ab "Vorrunde beginnen" statt schon bei der Spielplan-Generierung), das war aber ein Missverständnis der eigentlichen Anforderung. Richtig, wie schon in der ursprünglichen Diskussion zur Frage "Braucht man dann überhaupt ein BYE-Team?" festgehalten: Ein Freilos soll **überhaupt nicht** in die Tabellenberechnung eingehen — kein Sieg, keine Niederlage, kein Score-Beitrag für irgendjemanden, an keinem Zeitpunkt. Das ist unproblematisch, da jedes Team einer ungerade großen Gruppe über den vollständigen Rundenplan hinweg exakt einmal spielfrei hat.

Endgültiger Fix: `addTeamGame` (`firestoreService.js`) bekommt für ein Freilos-Spiel gar keinen Aufruf mehr — `Preliminary.js`s `handleMakeSchedule` überspringt Freilos-Einträge beim Anlegen der Team-Statistik-Platzhalter komplett (`if (team1 === "BYE" || team2 === "BYE") return;`). Für ein Freilos existiert dadurch nie ein Eintrag in `teams/{id}.matches`, wodurch es in `computeTeamStats` (Siege/Niederlagen/Score) vollständig unsichtbar bleibt — exakt wie ein noch nicht gespieltes reguläres Match, nur dass es nie "nachgeholt" wird. Der zwischenzeitlich eingeführte Ansatz mit verzögerter Wertung (`resolvePreliminaryByeMatches`, aufgerufen bei "Vorrunde beginnen") wurde komplett wieder entfernt. Der Spielplan selbst (`saveSchedule`, Matchday-Dokument) bleibt unverändert sofort mit `played: true` sichtbar — die Vorschau soll weiterhin "[Team] spielfrei" zeigen, nur die aggregierte Team-Tabelle bekommt dafür nie einen Eintrag.

**Verifikation:** Turnier mit ungerader Gruppengröße (z.B. 14 Teams / 2 Gruppen à 7) durchspielen — die Tabelle darf zu keinem Zeitpunkt (weder vor noch nach "Vorrunde beginnen", weder während noch nach der Vorrunde) einen zusätzlichen Sieg/Niederlage oder Score-Beitrag durch das Freilos zeigen; jedes Team hat am Ende genau `teamsPerGroup - 1` gewertete Spiele (nicht `teamsPerGroup`).

**Nachtrag (2026-08-21) — Freilos ans Ende des (Gruppen-)Spieltags:** `MatchdayTabs.js` zeigte das Freilos-Spiel an seiner zufälligen Position im gemischten Spielplan, oft mitten zwischen den echten Spielen. Sortierung der `matchEntries` erweitert: nach Gruppe (falls vorhanden) wird jetzt zusätzlich nach `isByeMatch` sortiert (Freilos-Spiele zuletzt), erst danach nach Match-Key — betrifft Mobile-Kartenliste und Desktop-Tabelle gleichermaßen (gemeinsam berechnete `matchEntries`), auch ohne Gruppen (`groupCount === 1`) wirksam.

**Verifikation:** Turnier mit 2 Gruppen à 7 Teams (ungerade) im Modus "Jeder gegen jeden" anlegen — Spieltage-Anzahl sollte automatisch 7 sein (nicht 6), jeder Spieltag sollte in jeder Gruppe genau ein "spielfrei" enthalten, das über die Spieltage rotiert, und die Gruppentabelle am Ende sollte alle Teams mit gleich vielen Spielen (inkl. genau einem Freilos-Sieg) und einer nachvollziehbaren Rangfolge zeigen. Regressionstest: "Feste Spieltaganzahl" mit gerader Gruppengröße weiterhin wie bisher, inkl. der bestehenden Validierungsfehler bei ungerader Größe in diesem Modus.

**Korrektur (2026-08-21) — Gruppen nur mit anschließender KO-Runde, "Keine KO-Runde" in den Turniermodus verschoben:** Auf Wunsch des Projektinhabers zwei zusammenhängende UX-Änderungen in `NewTournamentSetup.js`: (1) Die Turniermodus-Auswahl hat jetzt drei statt zwei Optionen — "Vorrunde + KO-Runde", "Nur Vorrunde (keine KO-Runde)" und "Direkt-KO (ohne Vorrunde)". Intern bleibt `mode` weiterhin nur `"roundrobin"`/`"directko"` (unverändertes Datenmodell/`firestoreService.js`); ein neues, rein clientseitiges Flag `roundRobinHasKO` unterscheidet die beiden `"roundrobin"`-Varianten und wird nicht persistiert — "keine KO-Runde" wird wie schon vorher rein über `koRounds: 0` abgebildet, nur die Bedienung dafür sitzt jetzt auf oberster Ebene statt als Eintrag `{label: "Keine KO-Runde", rounds: 0}` im bisherigen `KO_ROUND_OPTIONS`-Wähler (dieser Eintrag wurde dort entfernt). (2) Das Feld "Anzahl Gruppen" (und der gesamte KO-Konfigurationsblock darunter) wird nur noch angezeigt, wenn `!isPreliminaryOnly` — Gruppen sind bei "Nur Vorrunde" nicht mehr wählbar, da sie zwingend eine anschließende KO-Runde voraussetzen (Wechsel zu "Nur Vorrunde" setzt `groupCount` zusätzlich defensiv auf 1 zurück). Als Nebeneffekt entfällt die bisherige "Anschließende KO-Runde"-Checkbox bei Gruppen komplett (war nur nötig, um Gruppen *ohne* KO-Runde zu erlauben — das ist jetzt durch die neue Turniermodus-Option von vornherein ausgeschlossen): Sind Gruppen aktiv, ist die KO-Runde jetzt unbedingt vorhanden, das Feld "Qualifikanten pro Gruppe" erscheint direkt ohne Checkbox davor.

**Korrektur (2026-08-21) — keine Gruppen-internen Rematches in Runde 1, Platzhalter zeigen Gruppe+Rang:** Der vorherige Fix (pro Rang-Stufe unabhängig gemischte Gruppenreihenfolge) konnte dazu führen, dass zwei Teams derselben Vorrundengruppe (die sich in der Vorrunde bereits im Round-Robin begegnet sind) direkt in KO-Runde 1 erneut aufeinandertreffen — vom Projektinhaber explizit unerwünscht. Root Cause: `generateKORound`s Spiegel-Paarung (Position p gegen Position `Anzahl_Qualifizierter - 1 - p`) verbindet bei mehreren Rang-Stufen jeweils Position p einer Stufe mit Position `Anzahl_Gruppen - 1 - p` einer anderen (oder derselben) Stufe; war die Gruppenreihenfolge pro Stufe unabhängig zufällig, konnte an Position p in Stufe A zufällig dieselbe Gruppe stehen wie an der gespiegelten Position in Stufe B.

Fix: `interleaveGroups` (`firestoreService.js`) bekommt jetzt eine explizite, **für alle Rang-Stufen identische** Gruppenreihenfolge (`groupOrder`) übergeben, statt pro Stufe neu zu mischen. Dadurch sitzt eine gegebene Gruppe in *jeder* Rang-Stufe an derselben Bracket-Position p — und da Gruppenanzahl und Qualifikanten/Gruppe laut Validierung in `NewTournamentSetup.js` beide Zweierpotenzen sein müssen (ihr Produkt muss eine Zweierpotenz sein, die einzigen Teiler einer Zweierpotenz sind selbst Zweierpotenzen), ist die Gruppenanzahl bei `groupCount > 1` immer gerade — damit gilt `p ≠ (Anzahl Gruppen - 1 - p)` für jedes p, und eine Gruppe kann sich in Runde 1 nie selbst begegnen. Die "beste zuerst gegen schlechteste, Beste treffen sich erst spät"-Eigenschaft bleibt dabei unverändert erhalten (hängt nur von der Reihenfolge *zwischen* den Rang-Stufen ab, nicht von der Reihenfolge innerhalb einer Stufe).

Diese `groupOrder` wird nicht mehr erst bei der KO-Rundengenerierung zufällig bestimmt, sondern bereits beim Abschluss von `TeamSetup.js` (`shuffleArray` einmalig auf `[0..groupCount-1]` angewendet, persistiert als `koGroupOrder` auf dem Turnier-Root-Dokument über neue Funktion `setKnockoutGroupOrder`) — dadurch ist die Zuordnung während der gesamten Vorrunde bereits fix und bekannt, nicht erst nach deren Abschluss. `Preliminary.js` lädt `koGroupOrder` und reicht es an `generateFirstKORound` durch.

**Platzhalter-Anpassung:** `KORoundTab.js` zeigte die Runde-1-Platzhalter bisher als flache "VR Platz N"-Nummerierung (1..Gesamtqualifizierte), die bei mehreren Gruppen nichtssagend war. Neue Funktion `preliminaryPlaceholderLabel(id)` rechnet die Position `id` (1-basiert, exakt die von `interleaveGroups` erzeugte Reihenfolge) über `koGroupOrder` in Gruppe + Rang-innerhalb-der-Gruppe um und zeigt z.B. "1. Gruppe A" statt "VR Platz 3". `KORoundTab.js` lädt dafür `groupCount`/`koGroupOrder` einmalig beim Mount (nur relevant für `roundIndex === 1`). Bei `groupCount === 1` unverändert "VR Platz N".

**Korrektur (2026-08-21) — zufällige Gruppenzuordnung auf die KO-Bracket-Positionen:** Die erste Umsetzung von `interleaveGroups` (`firestoreService.js`) reihte pro Rang-Stufe die Gruppen immer in fester Reihenfolge (A, B, C, …) aneinander — welche Gruppe auf welche Bracket-Position kommt, war damit deterministisch statt zufällig, wie vom Projektinhaber gewünscht. Analyse ergab: Die eigentliche "beste Teams treffen früh auf die schwächsten, die stärksten treffen sich erst spät (im Idealfall erst im Finale)"-Eigenschaft war durch `generateKORound`s rekursive "1 vs letzter Platz"-Paarung bereits korrekt gegeben (mathematisch äquivalent zur klassischen Turnierbaum-Setzung — nachgerechnet für mehrere Gruppen-/Qualifikanten-Kombinationen) und hängt einzig von der Reihenfolge *zwischen* den Rang-Stufen ab (erst alle Rang-1, dann alle Rang-2, …), nicht von der Reihenfolge *innerhalb* einer Rang-Stufe. Fix daher gezielt nur dort: `interleaveGroups` mischt jetzt innerhalb jeder Rang-Stufe zufällig (neuer Helper `shuffleArray`, gleiches Zufalls-Idiom wie das bereits bestehende `shuffleSchedule` in `Preliminary.js`), bevor die Stufen zur Setzliste aneinandergereiht werden — die Stufen-Reihenfolge selbst bleibt unangetastet und garantiert weiterhin die gewünschte Setzungseigenschaft.

**Korrektur (2026-08-21) — Gruppentabellen über Tabs statt nebeneinander:** Erste Umsetzung von `StandingsTable.js` zeigte bei mehreren Gruppen alle Gruppentabellen gleichzeitig nebeneinander (Flex-Wrap). Auf Wunsch des Projektinhabers umgebaut: analog zu den bereits bestehenden Spieltag-Tabs in `Preliminary.js` (MUI `Tabs`/`Tab`) gibt es nun einen Tab pro Gruppe ("Gruppe A", "Gruppe B", …, lokaler `groupTab`-State), darunter wird nur die Tabelle der ausgewählten Gruppe gerendert. Bei `groupCount === 1` weiterhin unverändert eine einzelne Tabelle ohne Tabs/Überschrift.

**Korrektur (2026-08-21) — Spieltagsanzahl bezieht sich auf die Gruppengröße:** Das Feld "Wie viele Spieltage soll die Vorrunde haben?" begrenzte sein Maximum bisher auf `numberTeams - 1` (vollständiger Rundenplan über alle Teams). Mit Gruppen spielt aber jede Gruppe unabhängig ihren eigenen Rundenplan über `teamsPerGroup - 1` Spieltage (siehe `generateSchedule()` in `Preliminary.js`); ein auf der Gesamtteamzahl basierendes Maximum war daher bei mehr als einer Gruppe zu hoch angesetzt. Auf Hinweis des Projektinhabers: Feld steht jetzt in der Formularreihenfolge nach "Anzahl Gruppen" (statt davor) und sein `max` richtet sich nach `teamsPerGroup - 1` statt `numberTeams - 1`. Neuer Helper `clampMatchdays(teamCount, groupCount)` kappt den aktuellen Wert automatisch nach unten, sobald sich Teamanzahl oder Gruppenanzahl ändern und der bisherige Wert das neue Maximum überschreiten würde (analog zum bereits bestehenden Muster, das `koRounds` bei Teamanzahl-Änderung zurücksetzt). Bei `groupCount === 1` identisch zum bisherigen Verhalten (`teamsPerGroup === numberTeams`).

`TeamSetup.js`: Teams (`teams/{teamId}.group`, Default beim Anlegen `0`) werden beim Laden automatisch reihum auf die Gruppen verteilt (`index % groupCount`), zeigt bei `groupCount > 1` pro Team zusätzlich ein Dropdown zur manuellen Überschreibung. Beim Absenden wird `updateTeamGroups` nur aufgerufen, wenn `groupCount > 1` (unverändertes Verhalten bei einer Gruppe).

`Preliminary.js`: `generateSchedule()` erzeugt bei `groupCount > 1` pro Gruppe einen eigenen, unabhängig gemischten Rundenplan (`generateRoundRobinSchedule` pro Gruppe, da gleich große Gruppen garantiert sind) und führt sie matchdayweise zusammen (Runde *r* aller Gruppen landet auf demselben Spieltag); jedes Match trägt fortan ein `group`-Feld (persistiert über `saveSchedule`/`matches.*.group`). Bei `groupCount === 1` bleibt das bisherige Verhalten (inkl. optionalem globalen BYE-Team) unverändert. `handleFinishPreliminary` ruft `generateFirstKORound` mit `groupCount`/`qualifiersPerGroup` auf.

`generateFirstKORound` (`firestoreService.js`): teilt Teams zunächst nach `group` auf, sortiert pro Gruppe nach der bestehenden Tie-Break-Logik, nimmt pro Gruppe die besten `qualifiersPerGroup` (bzw. bei `groupCount === 1` weiterhin `2^koRounds`) und fügt Qualifizierte wie Ausgeschiedene getrennt per neuem Helper `interleaveGroups` rangweise zusammen (Rang 1 aller Gruppen, dann Rang 2 aller Gruppen, …) — bewusst kein Anti-Gruppen-Seeding. Die resultierende interleavte Liste geht unverändert in die bestehende `generateKORound`-Paarung (1 vs. letzter Platz, …) ein.

`StandingsTable.js`: bei `groupCount > 1` eine eigene Tabelle pro Gruppe (Überschrift "Gruppe A"/"Gruppe B"/…, responsive nebeneinander per Flex-Wrap), bei `groupCount === 1` unverändert eine einzelne Tabelle.

**Zusatzfund/-ergänzung (nicht explizit im ursprünglichen Entwurf, aber notwendig für Nutzbarkeit):** Da mehrere Gruppen sich jetzt denselben Spieltag teilen, wären die Spiele in `MatchdayTabs.js` ohne Kennzeichnung nicht mehr eindeutig einer Gruppe zuzuordnen. `MatchdayTabs.js` sortiert die Matches eines Spieltags bei `groupCount > 1` daher zunächst nach `group`, zeigt eine "Gruppe X"-Überschrift, sobald sich die Gruppe zur vorigen Zeile ändert (Mobile-Card-Liste und Desktop-Tabelle je mit eigener, aber analoger Umsetzung), und lässt das Verhalten bei `groupCount === 1` unverändert.

**Nicht im Scope:** ungleich große Gruppen, ungerade Gruppengrößen (Freilos pro Gruppe), zusätzliche Tiebreak-Regeln, ausgefeiltes Cross-Gruppen-Seeding.

**Verifikation:** 8 Teams / 2 Gruppen à 4 / `qualifiersPerGroup=2` durchspielen — insbesondere prüfen, dass beide Gruppen-Tabellen korrekt getrennt sind, die Spieltage die Spiele beider Gruppen mit klarer Gruppenkennzeichnung zeigen, und die generierte erste KO-Runde die erwartete interleavte Paarung (A1 vs. B2, B1 vs. A2 bei 2 Qualifikanten/Gruppe) enthält.

### Phase 3d – Bugfix + Rangfolge ohne Spiel um Platz 3 ✅ Umgesetzt (2026-08-28)

**Gemeldeter Bug (2026-08-21):** In einem Direkt-KO-Turnier mit Freilosen (siehe Nachtrag zu Phase 3b) und **ohne** Spiel um Platz 3 zeigt die Abschlusstabelle „BYE“ auf Platz 3 an.

**Root Cause (zwei zusammenhängende Defekte):**
1. `generateNextKORound` (`firestoreService.js`): Beim Übergang von der vorletzten Runde (Halbfinale) zur letzten Runde (Finale) ist `isFinal === true`, daher greift der bestehende `if (!isFinal) { … finalRank … }`-Zweig nicht. Ohne Spiel um Platz 3 (dessen Ergebnis sonst von `updateRankingFinals` ausgewertet wird) bekommen die beiden Halbfinal-Verlierer dadurch **nie** ein `finalRank` zugewiesen — bleibt beim Default `-1`.
2. `FinalStandings.js` sortiert alle Teams aus `getAllTeams(...)` nach `finalRank`, filtert dabei aber (anders als `StandingsTable.js`, die `.filter(t => !t.isBye)` nutzt) keine `isBye`-Teams heraus. Das „BYE“-Pseudo-Team hat ebenfalls dauerhaft `finalRank: -1` (wird seit dem Freilos-Fix aus Runde 1 nie mehr angefasst, da explizit aus Gewinner-/Verlierer-Listen ausgeschlossen) und landet deshalb ungefiltert zusammen mit den unbewerteten Halbfinal-Verlierern ganz oben in der aufsteigend sortierten Liste.

**Gewünschte Erweiterung (Projektinhaber):** Gibt es kein Spiel um Platz 3, sollen beide Halbfinal-Verlierer gemeinsam auf Platz 3 geführt werden (geteilter 3. Platz), statt gar keinen Rang zu bekommen.

**Geplante Umsetzung:**
- `generateNextKORound`: neuer `else if`-Zweig neben dem bestehenden `if (!isFinal)` — wenn `isFinal && !hasThirdPlace && losers.length > 0`, allen Teams in `losers` `finalRank: 3` zuweisen. Funktioniert auch bei `losers.length === 1` (Halbfinale mit Freilos, bei dem nur ein echter Verlierer existiert).
- `FinalStandings.js`: `getAllTeams(...)`-Ergebnis vor der Sortierung um `.filter(t => !t.isBye)` ergänzen (analog `StandingsTable.js`).
- Betrifft **nicht nur** Direkt-KO: Der fehlende `finalRank` für Halbfinal-Verlierer ohne Platz-3-Spiel besteht unabhängig vom Turniermodus, sobald `koRounds >= 2` und `hasThirdPlace === false` — der Freilos-Fall hat ihn nur sichtbar gemacht, weil zusätzlich das „BYE“-Team betroffen war.

**Umsetzung:** `generateNextKORound` (`firestoreService.js`) bekommt neben dem bestehenden `if (!isFinal)`-Zweig einen `else if (!hasThirdPlace && losers.length > 0)`-Zweig, der allen Teams in `losers` `finalRank: 3` zuweist — funktioniert auch mit nur einem Eintrag in `losers` (Halbfinale mit Freilos). `FinalStandings.js` filtert `isBye`-Teams jetzt vor der Sortierung heraus (analog `StandingsTable.js`).

**Zusatzfund beim Testen — Anzeige eines geteilten Ranges war trotz korrektem `finalRank` falsch:** Die bisherige Aufteilung in `FinalStandings.js` (`sortedTeams.slice(0, 3)`/`slice(3)`, feste Array-Indizes) und die Rang-Beschriftung in `FinalRankList.js` (`startRank + index`, rein sequenziell) gingen implizit davon aus, dass genau ein Team pro Rang existiert. Bei geteiltem 3. Platz (zwei Teams mit `finalRank: 3`) wäre eines der beiden Teams durch `slice(0, 3)` in die "Restliste" gerutscht und dort fälschlich als "4." angezeigt worden — der eigentliche Zweck der Erweiterung ("beide gemeinsam auf Platz 3") wäre in der UI nicht sichtbar gewesen. Fix: `FinalStandings.js` liefert jetzt `{rank, name}`-Objekte und teilt anhand von `rank <= 3` statt eines festen Array-Index auf; `Podium.js` gruppiert die Teams pro Rang (`namesByPlace`) und zeigt bei einem geteilten Platz beide Namen (`" / "`-getrennt) auf demselben Podestplatz; `FinalRankList.js` zeigt den tatsächlichen `team.rank` statt eines aus der Position hochgezählten Rangs.

**Bugfix (2026-08-28) — Verlierer-Rang für Runden vor dem Halbfinale falsch berechnet (vom Projektinhaber beim Testen gefunden):** Bei einem Turnier mit `koRounds >= 3` zeigte die Abschlusstabelle nach dem geteilten 3. Platz die nächsten Ränge als "9./10." statt "5./6.". Root Cause, unabhängig von der eigentlichen Phase-3d-Änderung und schon vorher im Code vorhanden: `baseRank = winners.length * 2 + 1` in `generateNextKORound`s `!isFinal`-Zweig widersprach dem eigenen Kommentar direkt daneben ("z.B. bei 4 Gewinnern → Rang 5") — bei 4 Gewinnern ergibt die Formel 9, nicht 5. Betraf bislang nur Turniere mit `koRounds >= 3` (Achtelfinale oder größer), da der `!isFinal`-Zweig erst ab der vorletzten Nicht-Endrunde greift; bei `koRounds === 2` (nur Halbfinale+Finale) lief immer der `isFinal`-Zweig, weshalb der Fehler bislang unbemerkt blieb. Fix: `baseRank = winners.length + 1`.

**Nicht im Scope:** weitere Tiebreak-Kriterien zwischen den beiden geteilten Dritten (z.B. anhand Legdifferenz).

**Verifikation:** Turnier (Direkt-KO und regulär mit Vorrunde) mit `koRounds >= 2` und `hasThirdPlace = false` bis zum Ende durchspielen — Abschlusstabelle muss beide Halbfinal-Verlierer auf Platz 3 zeigen, kein „BYE“ in der Liste. Zusätzlich ein Direkt-KO-Turnier mit Freilosen und `hasThirdPlace = true` gegenprüfen (Regressionstest für das reguläre Spiel um Platz 3).

### Phase 3e – Doppel-KO / Loser-Bracket für Direkt-KO ✅ Umgesetzt (2026-08-28)

**Ziel:** In Direkt-KO-Turnieren (`mode === "directko"`) optional ein Verlierer-Bracket anbieten, sodass ein Team nach einer Erstrunden-Niederlage nicht sofort ausscheidet, sondern über den Umweg des Loser-Brackets noch das Grand Final erreichen kann.

**Entwurf (zur Bestätigung vor Umsetzung, siehe offene Fragen unten):**
- `tournaments/{id}`: neues Feld `koFormat: "single" | "double"` — nur wählbar bei `mode === "directko"`, Default `"single"` (bisheriges Verhalten unverändert).
- v1-Eingrenzung: `koFormat: "double"` zunächst nur für Teamanzahlen, die exakte Zweierpotenzen sind. Freilose (Phase-3b-Nachtrag) + Loser-Bracket gemeinsam sind ungleich komplexer in der Bracket-Mathematik (ein Freilos-„Sieg“ darf im Loser-Bracket nicht wie eine echte Niederlage behandelt werden) — bewusst nicht in v1.
- Struktur: Gewinner-Bracket (WB) bleibt exakt wie bisher (`knockout/round_N`). Neues Verlierer-Bracket (LB) wird in derselben `knockout`-Subcollection unter eigenen Stage-Keys (z.B. `l_round_N`) abgelegt — spart eine neue Subcollection/neue Subscribe-Funktionen, da `getKnockout`/`subscribeKnockoutRound`/`saveKOScore`/`updateAllKOsPlayed` bereits generisch über den `stage`-String parametrisiert sind.
- Progression: Verlierer aus WB-Runde *i* fallen an der jeweils passenden Stelle ins LB (Standard-Doppel-KO-Bracket-Schema). Braucht eine neue Generierungsfunktion `generateLoserBracketRound(...)`; die genaue Rundenanzahl/Zuordnung im LB folgt der etablierten Doppel-KO-Bracket-Formel und muss beim Implementieren anhand von Referenzschemata (4-/8-/16er-Bracket) verifiziert werden.
- Grand Final: WB-Sieger trifft LB-Sieger in einem einzigen entscheidenden Spiel. **Bewusste v1-Vereinfachung:** kein „Bracket Reset“ (kein zweites Grand-Final-Spiel, falls der LB-Sieger gewinnt) — für ein Freizeit-Dart-Turnier-Tool ausreichend und spart zusätzliche Zustandslogik; kann bei Bedarf später nachgerüstet werden.
- `Running.js`: zweiter Tab-Block für die LB-Runden (z.B. „Loser-Runde 1“, „Loser-Runde 2“, …), analog zum bestehenden WB-Tab-Aufbau.
- `KORoundTab.js`: bereits rundenagnostisch für WB — prüfen, ob 1:1 für LB-Runden wiederverwendbar oder eine Variante nötig ist (andere Statuswerte/Labels wie „Loser-Achtelfinale“).
- Statusmaschine: `nextStatus`/`statusToStage` müssen um WB-/LB-Übergänge und das Grand Final erweitert werden (neue Statuswerte, z.B. `lko_N` analog zu `ko_N`).

**Offene Fragen — mit dem Projektinhaber geklärt (2026-08-28):**
1. Doppel-KO bleibt dauerhaft auf Direkt-KO beschränkt (nicht für Vorrunde + KO).
2. Bracket Reset wird **pro Turnier wählbar** gemacht (nicht fest verdrahtet, nicht fest deaktiviert) — neue Checkbox in `NewTournamentSetup.js`, nur bei `koFormat === "double"` sichtbar.
3. Freilose bleiben dauerhaft außerhalb des Scopes — `koFormat: "double"` bleibt auf Zweierpotenzen-Teamanzahlen (≥ 4) beschränkt.

**Umsetzung:** `firestoreService.js` bekommt `loserStageKey`/`loserStatusKey`/`GRAND_FINAL_STAGE`/`GRAND_FINAL_RESET_STAGE`/`GRAND_FINAL_STATUS`/`GRAND_FINAL_RESET_STATUS`, die reine Funktion `getLbSchedule(koRounds)` (Quelle der Wahrheit für die LB-Rundenstruktur: abwechselnd "reduce"- und "drop"-Runden, validiert für 4- und 8-Team-Brackets gegen die Standard-Doppel-KO-Form) sowie `loserRoundLabel`/`lbEliminationBaseRank` (Formel `totalTeams - eliminatedBefore - thisLoserCount + 1`, numerisch gegen die 4-/8-Team-Fälle geprüft). `generateKORound` wurde intern in eine stage-key-parametrisierte `generateBracketRound`-Kernfunktion plus dünnen Wrapper zerlegt (öffentliche Signatur unverändert), wiederverwendet von der neuen `generateLoserBracketRound`. Neue Orchestrator-Funktionen `advanceLoserBracket` (idempotent, generiert genau die nächste LB-Runde, deren Voraussetzungen aus `wbRoundLosers`/`lbRoundWinners` auf dem Turnierdokument vorliegen), `generateGrandFinal`/`generateGrandFinalReset`, sowie `finishDoubleElimWbRound`/`finishLoserBracketRound` als High-Level-Einstiegspunkte für die Komponentenebene (kapseln Batch-Writes/Ranking, damit `KORoundTab.js` weiterhin nur fertige Service-Funktionen aufruft statt selbst Firestore-Batches zu bauen). `updateRankingDoubleElim` ermittelt Rang 1/2 aus dem entscheidenden Grand-Final-Spiel (Spiel 2 bei ausgelöstem Reset, sonst Spiel 1); Rang 3 und alle niedrigeren Ränge werden bereits beim jeweiligen LB-Rundenabschluss über die aus `generateNextKORound` herausgezogene, jetzt gemeinsam genutzte `assignSharedFinalRanks` vergeben. `generateNextKORound` bekommt einen `koFormat`-Parameter und überspringt die Verlierer-Rangvergabe im Doppel-KO-Fall komplett (ein WB-Rundenverlierer ist dort noch nicht ausgeschieden, sondern spielt im LB weiter). Neues additives Feld `roundFinished` auf jedem `knockout/{stage}`-Dokument (WB, LB, Grand Final) steuert im Doppel-KO die Editierbarkeits-Sperre pro Runde (`markRoundFinished`), da der globale Turnier-`status` dort nicht mehr linear ist (`nextStatus`/`statusToStage` geben sich im Doppel-KO-Fall als reiner "zuletzt erreichte Runde"-Marker zu erkennen, ohne Anspruch auf Autorität für die Editierbarkeit).

`KORoundTab.js` wurde um `bracket`("winner"/"loser")- und `koFormat`-Props erweitert statt in eine LB-Variante geforkt zu werden (strukturell identisch bis auf Status-/Label-Herleitung und Rundenabschluss-Verzweigung); der bisher hartcodierte `` `ko_${roundIndex}` ``-Statuskey wurde durch `koStatusKey`/`loserStatusKey` ersetzt. Platzhalter für ungenerierte LB-Runden nutzen bewusst nur generischen Text statt der WB-spezifischen `koStageMatchMap`-Bracket-Positionstabelle (deren Halbierungs-Annahme für die unregelmäßige LB-Rundengröße nicht passt). `MobileMatchCard`/`DesktopMatchRow` wurden aus `KORoundTab.js` exportiert und von der neuen, schlanken `GrandFinalTab.js` wiederverwendet (eigene Komponente statt Erweiterung von `KORoundTab`, da der Rundenabschluss dort eine Sonderlogik hat: ggf. zweites Spiel statt Turnierende, kein Platzhalter-/Platz-3-Konzept).

`Running.js` lädt `koFormat`/`bracketReset` zusätzlich zu `koRounds`/`hasThirdPlace`/`mode`, erweitert Tabs/`statusLabelMap`/`statusColorMap` um LB-Runden und Grand-Final-Tab(s) bei `koFormat === "double"`. `RequireTournament.js`s `isValidStage` sowie `statusToStage`-Aufrufe in `LoadTournamentSetup.js`/`DirectKOSeeding.js` wurden um den `koFormat`-Parameter ergänzt. `NewTournamentSetup.js` bekommt zwei neue Checkboxen im Direkt-KO-Zweig ("Doppel-KO (Loser-Bracket)", nur bei Zweierpotenz-Teamanzahl ≥ 4 aktivierbar; "Bracket Reset im Grand Final", nur bei aktiviertem Doppel-KO sichtbar) sowie einen Reset-Mechanismus, der `koFormat` bei einer Teamanzahl-Änderung auf eine ungültige Zweierpotenz automatisch zurücksetzt (analog zum bestehenden KO-Runden-Reset-Muster). Die "Spiel um Platz 3"-Checkbox wird bei `koFormat === "double"` ausgeblendet und der Wert beim Absenden zwangsweise auf `false` gesetzt, da sich 3./4. Platz automatisch aus der LB-Struktur ergibt. `firestore.rules` musste nicht geändert werden — die bestehende `match /{subcollection}/{docId}`-Wildcard-Regel deckt die neuen `knockout`-Stage-Keys (`l_round_N`, `grandfinal`, `grandfinal2`) bereits automatisch ab.

**Nicht im Scope:** Doppel-KO für den regulären Vorrunde+KO-Modus, Freilose im Loser-Bracket, weitere Tiebreak-Kriterien zwischen gleichzeitig in derselben LB-Runde ausgeschiedenen Teams.

**Verifikation:** Direkt-KO-Turnier mit 4 und mit 8 Teams im Doppel-KO-Modus komplett durchspielen — insbesondere den Fall, dass ein Team erst im Loser-Bracket ausscheidet, sowie das Grand Final (einmal mit, einmal ohne ausgelösten Bracket Reset, je einmal mit `bracketReset` aktiviert und deaktiviert im Setup). Regressionstest: Single-Elim-Turniere (mit und ohne bestehendes `koFormat`-Feld) unverändert durchspielen.

### Phase 4 – PDF/Print-Export + Excel-Fix ✅ Umgesetzt (2026-08-28)

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

**Umsetzung:** `exportService.js` verlässt sich nicht mehr auf den übergebenen Turnierstatus, um Sheets ein-/auszublenden, sondern lädt `getTournamentData` selbst und prüft pro möglicher Runde/Stage per `getKnockout`, ob dort bereits Matches existieren (`appendKORound` überspringt leere/ungenerierte Runden intern) — dadurch funktioniert der Export unabhängig von `koRounds`, Gruppen, Direkt-KO und Doppel-KO, ohne die frühere feste `quarterfinals`/`semifinals`/`final`-Namensliste. Winner-Bracket-Runden werden über `koStageKey(r)`/`koRoundLabel` durchiteriert (`r = 1..koRounds`), bei `mode === "directko" && koFormat === "double"` zusätzlich das Loser-Bracket (`getLbSchedule`/`loserStageKey`/`loserRoundLabel`) sowie Grand Final/Grand Final Reset. Die Vorrunden-Sheets ("Vorrunde_Ergebnisse"/"Vorrunde_Tabelle") werden nur bei `mode !== "directko"` erzeugt und bekommen bei `groupCount > 1` eine zusätzliche "Gruppe"-Spalte (Tabelle: eine gemeinsame Sheet-Liste, pro Gruppe separat sortiert). `Running.js`s `handleExport` ruft `exportTournamentResults` jetzt nur noch mit der Turnier-ID auf (kein `status`-Parameter mehr nötig).

Für den Druck-Export wurde bewusst keine neue Komponente pro Ansicht wiederverwendet (StandingsTable/KORoundTab sind MUI-/Theme-gebunden und für eine A4-Druckseite ungeeignet), sondern `TournamentPrintView.js` rendert alle Abschnitte (Abschlussplatzierungen, Teams, Vorrunden-Spielplan/-Tabelle je Gruppe, Winner-/Loser-Bracket, Grand Final) mit eigenen einfachen HTML-Tabellen, deren Look ausschließlich über `print.css` (unabhängig vom aktuell aktiven Dark/Light-MUI-Theme) gesteuert wird — Abschnitte ohne Daten (z.B. Vorrunde bei Direkt-KO, LB/Grand Final bei Single-Elim) werden komplett ausgeblendet. Die Route `print` liegt als `mode`-loses Geschwister von `teams`/`seeding` unter `TournamentLayout`/`RequireTournament` — dadurch nur ein Existenz-Check, aber kein PIN-Zwang (rein lesend) und keine Stage-Validierung/-Umleitung. `Running.js` bekommt einen zweiten Fab-Button (`PrintIcon`, über dem bestehenden Excel-Download-Button), der die Druckansicht in einem neuen Tab öffnet (`window.open`, damit die laufende Turnieransicht nicht verloren geht).

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
