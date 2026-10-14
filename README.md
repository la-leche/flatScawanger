# flatScawanger

Beide Subagents sind angekreuzt. Start laeuft die Liste von oben nach unten. Der naechste beginnt erst, wenn der vorherige fertig ist. Nicht parallel.

| Subagent | URL | HTML |
| --- | --- | --- |
| immoscout-search | https://www.immoscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-mieten | div[data-obid] |
| kleinanzeigen-search | https://www.kleinanzeigen.de/s-wohnung-mieten/frankfurt-am-main/c203l4292 | #srchrslt-adtable > li |

Seite 1 wird nur einmal geoeffnet. Kein zweites tabs.update, waehrend Kleinanzeigen auf /c203l4292 umleitet.

Chrome: Ordner als entpackte Erweiterung laden, auf chrome://extensions Reload druecken, dann Start. Cookie-Dialog im offenen Tab selbst bestaetigen.
