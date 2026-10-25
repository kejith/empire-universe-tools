# Empire Universe Tools

Kostenlose, deutschsprachige Community-Helfer für [Empire Universe 4](https://www.empire-universe.com). Statische Webseiten ohne Konto oder eigenes Backend.

## Anwendungen

| Anwendung | Zweck |
| --- | --- |
| [**Asteroiden-Mining-Flottenoptimierer**](https://kejith.github.io/empire-universe-tools/asteroiden-mining-flottenoptimierer/) | Beste Modulausrüstung, Abbauzeit und langfristigen Ertrag pro Stunde berechnen |
| [**Empire-Universe-Datenbank**](https://kejith.github.io/empire-universe-tools/datenbank/) | Schiffe, Module, Forschung, Gebäude und Konstanten aus dem Referenzexport durchsuchen |

## Datenbank

Unter `datenbank/` liegen eine vollständig statische Oberfläche und die Referenzdatei `referenzdaten.json`.

**Exportstand:** 25. Oktober 2026 (UTC: 24.10.2026, 23:40:53), Quelle: offizielle öffentliche Referenzendpunkte `/api/v1/reference/*`.

| Katalog | Umfang |
| --- | ---: |
| Module | 144 |
| Schiffsklassen | 30 |
| Forschungseinträge | 210 |
| Gebäudetypen | 11 |
| Konstanten | Kampf, Konstruktion, Mining |

Die JSON-Datei enthält die **Originalwerte und Originalnamen** des Exports. Viele Namen/Beschreibungen sind französisch; die Oberfläche ist deutsch. Die Datenbank zeigt Effekte, Slots, Kosten, Voraussetzungen, sortier- und filterbare Suchergebnisse sowie ursprüngliche Datensätze. Verlinkte Module lassen sich direkt im Flottenoptimierer übernehmen.

Das Datenarchiv ist ein **Snapshot**, keine Live-Verbindung zum Spiel. Werte und Freischaltungen können sich ändern. Der Export enthält keine eigenen Spielerfreischaltungen und keine Modulbestände.

### Performance und Bedienbarkeit

Der Flottenoptimierer startet **nicht mehr automatisch** beim Öffnen, beim Laden gespeicherter Einstellungen oder eines Freigabelinks. Mit „Beste Flotte berechnen“ wird eine exakte Berechnung in einem **dedizierten Web Worker** gestartet. Die Oberfläche bleibt während der Suche bedienbar; Fortschrittsmeldungen und „Berechnung abbrechen“ stehen bereit. Bei Änderungen an den Einstellungen wird die vorherige Suche beendet, damit keine veralteten Ergebnisse erscheinen.

Der Worker berechnet auch die alternativen Abbauzeiten und sendet nur die für die Anzeige benötigten Daten zurück. Die oft sehr großen internen Flotten-Zustände werden nicht an den Hauptthread übertragen. Es wird **keine Näherung** verwendet; bestehende Zustands- und Kombinationsgrenzen bleiben bestehen.

Für die Worker-Datei benötigt die lokal geöffnete Anwendung üblicherweise einen HTTP-Server (`python3 -m http.server 8000` im Repository-Verzeichnis) oder die GitHub-Pages-Version. Reine `file://`-Aufrufe können Browser-Sicherheitsbeschränkungen auslösen.

### Flottenoptimierer

Der Optimierer verwendet weiterhin als Spielmodell:

- Gemeinsamen Frachtraum für die gesamte Flotte und additive Abbaustärke.
- Frei einstellbare Flottengröße, Slots, reservierte Slots und Flugzeiten.
- Diskrete Abbauintervalle (standardmäßig 5 Minuten).
- **1.000 Ressourcen/Minute je Extraktionslevel × eingestellte Abbaueffizienz**.
- Optionale Flotten-Frachtgrenze.
- Gesamtbestand je Modultyp (leer = unbegrenzt).
- Exakte ganzzahlige Suche, begrenzt durch Schutzlimits für Rechenaufwand.

**Neu:** Über „Mining-Module aus Datenbank übernehmen“ können offizielle Slot-, Fracht- und Extraktionswerte geladen werden. Dabei bleiben bestehende Modulbestände (Max. Anzahl) und Aktivierungszustände erhalten. Noch nicht bekannte Module werden **deaktiviert** hinzugefügt, bis sie ausdrücklich ausgewählt werden. Die optionale Schiffsauswahl übernimmt die Slotzahl des gewählten Typs.

Es wird **nicht automatisch überprüft**, ob ein Nutzer ein Modul erforscht hat. Forschungsvoraussetzungen stehen in der Datenbank; verfügbare Module bitte entsprechend aktivieren. Mining-Optimierer, Stationsmodule und andere Spielmechaniken außerhalb des verwendeten Extraktions-/Frachtmodells werden nicht ungeprüft als Boni eingerechnet.

```text
Ressourcen pro Stunde =
  min(nutzbare Flottenfracht, Extraktionslevel × (1.000 × Abbaueffizienz / 100) × Abbauzeit)
  × 60 / (Hinflug + Abbauzeit + Rückflug)
```

Die Abbauzeit wird in zulässigen Intervallen optimiert. Angezeigte Ergebnisse sind langfristige Durchschnittswerte vollständiger Runden.

## Entwicklung

- `index.html` — Übersicht.
- `datenbank/` — Referenzdatenbank, Oberfläche und Snapshot.
- `asteroiden-mining-flottenoptimierer/` — Optimierer und Datenbank-Anbindung.
- `tests/` — Node.js-Regressionstests.
- `.github/workflows/pages.yml` — GitHub-Pages-Bereitstellung.

Tests lokal mit `node --test tests/*.test.mjs` ausführen. Die Webseiten benötigen keine Build-Tools. Die Referenzdatei wird lokal über den Webserver geladen, daher zum lokalen Testen statt `file://` einen HTTP-Server verwenden, etwa `python3 -m http.server 8000`.

*Unabhängiges Community-Projekt ohne offizielle Verbindung zum Spielbetreiber.*
