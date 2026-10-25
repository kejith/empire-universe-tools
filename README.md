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

### Deutsche Bezeichnungen und Modulbilder

Die deutschsprachige Darstellung ergänzt den unveränderten Referenzexport. `datenbank/lokalisierung-de.js` enthält **belegte deutsche Namen** aus einer vom Nutzer bereitgestellten, deutsch gerenderten Wiki-Seite (u. a. Frachtmodule, erste Laserwaffen, ausgewählte Schiffe und Forschung sowie elf Gebäude mit Beschreibungen). Für die übrigen Einträge werden redaktionelle deutsche Bezeichnungen und aus den tatsächlich vorhandenen numerischen Effekten erstellte **deutsche Kurzbeschreibungen** angezeigt. Diese sind bewusst **keine vollständigen wortgetreuen Übersetzungen** der französischen Originalbeschreibungen. Die Originalnamen und Originaltexte können in der Detailansicht unter „Originaldaten (JSON)“ eingesehen werden.

Die Modul- und Schiffsbilder stammen aus den bereits im öffentlichen Referenzexport vorhandenen `img`-URLs auf `eu4.s3.eu-west-3.amazonaws.com`. Für **alle 144 Module** ist eine solche URL enthalten. Bilder werden auf der Seite erst bei Bedarf geladen (Lazy Loading), nicht in GitHub gespeichert. Der bereitgestellte HTML-Export wurde **nicht** ins Repository übernommen.

Das Datenarchiv ist ein **Snapshot**, keine Live-Verbindung zum Spiel. Werte und Freischaltungen können sich ändern. Der Export enthält keine eigenen Spielerfreischaltungen und keine Modulbestände.

### Performance und Bedienbarkeit

### Schnellere Optimierung: Effizienz pro Slot

Im Flottenoptimierer stehen zwei Suchmethoden zur Wahl:

- **Schnell (Standard, Näherung):** Jedes Modul wird nach **Fracht/Slot** beziehungsweise **Extraktionslevel/Slot** bewertet. Ein Greedy-Verfahren montiert zunächst die effizientesten passenden Module und nutzt anschließend die nächstbesten Module, sofern Slots und globale Bestandsgrenzen es zulassen. Eine Multi-Start-Suche untersucht verschiedene Fracht-/Laser-Verhältnisse, Packreihenfolgen, priorisierte Einzelwerte und spezialisierte Schiffsausrüstungen. Die besten Kandidaten werden durch lokal geprüfte Modulaustausche verbessert. Die tatsächliche Zielfunktion bleibt langfristige **Ressourcen pro Stunde** unter Berücksichtigung von Flugzeit, Abbaueffizienz und diskreten Abbauaktionen. **Es handelt sich um eine Heuristik; ein globales Optimum ist nicht garantiert.**
- **Exakt (optional):** Weiterhin verfügbare dynamische Programmierung mit Pareto-Pruning. Zusätzlich werden nun unbeschränkt verfügbare Module, die ein anderes Modul bei gleicher oder geringerer Slotzahl in *Fracht und Extraktion* dominieren, vorab sicher herausgefiltert. Das reduziert den Suchraum **ohne die exakte Lösung zu ändern**. Die vorhandenen Speicher-/Rechenlimits bleiben bestehen.

Beide Methoden laufen im Web Worker, unterstützen die Abbrechen-Funktion und berücksichtigen alle aktivierten Module aus beiden Tabs. Die Suchmethode wird in JSON-Einstellungen gespeichert und bei neuen Freigabelinks im **Format v4** übernommen; frühere Links (v1–v3) werden weiterhin eingelesen.

Der Flottenoptimierer startet **nicht mehr automatisch** beim Öffnen, beim Laden gespeicherter Einstellungen oder eines Freigabelinks. Mit „Beste Flotte berechnen“ wird eine exakte Berechnung in einem **dedizierten Web Worker** gestartet. Die Oberfläche bleibt während der Suche bedienbar; Fortschrittsmeldungen und „Berechnung abbrechen“ stehen bereit. Bei Änderungen an den Einstellungen wird die vorherige Suche beendet, damit keine veralteten Ergebnisse erscheinen.

Der Worker berechnet auch die alternativen Abbauzeiten und sendet nur die für die Anzeige benötigten Daten zurück. Die oft sehr großen internen Flotten-Zustände werden nicht an den Hauptthread übertragen. Es wird **keine Näherung** verwendet; bestehende Zustands- und Kombinationsgrenzen bleiben bestehen.

Für die Worker-Datei benötigt die lokal geöffnete Anwendung üblicherweise einen HTTP-Server (`python3 -m http.server 8000` im Repository-Verzeichnis) oder die GitHub-Pages-Version. Reine `file://`-Aufrufe können Browser-Sicherheitsbeschränkungen auslösen.

### Flottenoptimierer

Der Optimierer verwendet weiterhin als Spielmodell:

- Gemeinsamen Frachtraum für die gesamte Flotte und additive Abbaustärke.
- Frei einstellbares **PA-Budget**, Schiffstyp, reservierte Slots und Flugzeiten. Die Slots und PA-Kosten je Schiff stammen aus dem gespeicherten Referenzexport. Die Schiffszahl ergibt sich aus `floor(Max. PA / PA pro Schiff)`. Für die exakte Suche werden derzeit höchstens 300 Schiffe und bis zu 500 Slots je Schiff unterstützt; nicht unterstützte Schiffstypen werden nicht angeboten.
- Diskrete Abbauintervalle (standardmäßig 5 Minuten).
- **1.000 Ressourcen/Minute je Extraktionslevel × eingestellte Abbaueffizienz**.
- Optionale Flotten-Frachtgrenze.
- Gesamtbestand je Modultyp (leer = unbegrenzt).
- Exakte ganzzahlige Suche, begrenzt durch Schutzlimits für Rechenaufwand.

**Permanenter Mining-Katalog:** Zehn echte Frachtmodule und sieben Asteroiden-Extraktionslaser aus der offiziellen Datenbank sind ab Werk enthalten, einschließlich Fracht L, Asteroiden-Laser III und der Alien-Artefaktmodule. Fracht und Laser werden in zwei Tabs angezeigt, aber zusammen optimiert. Seltene neue Module sind zunächst deaktiviert. Stamm-Module lassen sich deaktivieren, jedoch nicht versehentlich löschen. Benutzerdefinierte Module können weiterhin ergänzt und entfernt werden. Bestehende JSON-Exporte und teilbare Links (Version 1/2) werden auf das neue PA- und Modulformat (Version 3) migriert. Der Import aus der Datenbank ist nicht mehr notwendig.

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
