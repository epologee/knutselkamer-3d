# Knutselkamer in 3D

Een kamer van 278 bij 427 cm, nagebouwd als three.js-scene op basis van een iPhone LiDAR-scan. De wand tussen camera en kamer valt weg, zodat je van buitenaf naar binnen kijkt. Elk meubel is een los onderdeel dat je kunt selecteren, verslepen en een kwartslag draaien. Het doel is spelen met de indeling: bestaande meubels verplaatsen en later vervangen door meubels die nog gekocht of gebouwd worden.

## Bekijken

`https://knutselkamer.test` start de Vite dev-server via de gedeelde Caddy. De pagina herlaadt zelf bij elke wijziging in de broncode en na een herstart van de server. Het camerastandpunt staat in de URL (`?camera=x,y,z`), dus een herlaad laat het beeld staan. Verplaatste meubels blijven per browser bewaard; "Zet alles terug" herstelt de indeling uit de scan.

Zonder Caddy: `npm install` en `npm run dev`.

## Opbouw

- `src/room.js`: de vier wanden met deur, raam, plinten, radiator, gordijnen en de schilderijen. Alles wat aan een wand hangt verdwijnt samen met die wand.
- `src/furniture/`: één object per meubel met `name`, `size` (breedte, hoogte, diepte in meters) en `build(materials)`. De oorsprong ligt op de vloer in het midden van het grondvlak, de voorkant wijst naar lokaal +Z.
- `src/layout.js`: de catalogus van meubeltypen en `scannedLayout`, de plek en draaiing van elk meubel zoals de scan het aantrof. Een nieuw meubel is een nieuw object in `src/furniture/` plus een regel hier.
- `src/interaction.js`: selecteren, verslepen binnen de kamer en draaien.
- `src/main.js`: renderer, licht, ambient occlusion en de lichtprobe van de kamer zelf.

Het assenstelsel is in meters, +Y omhoog, oorsprong op de vloer in het midden van de kamer. De raamwand staat op -Z, de deurwand op -X.

Lichtinstellingen zijn te proberen via de URL: `exposure`, `sun`, `sky`, `window` en `bounce`.

## Van scan naar scene

De ruwe scan staat in `scan/` en blijft buiten git (290 MB, met foto's uit de kamer). Alle maten komen uit de LiDAR-mesh en de scanfoto's, die samen één stelsel delen. RoomPlan (`scan/Room/rooms/room-0.json`) levert alleen de eerste schatting: zijn wanden staan ongeveer 5 graden gedraaid en 10 cm verschoven ten opzichte van de mesh. `tools/roomframe.py` legt het kamerstelsel daarom vast op de wanden uit de mesh.

- `python3 -I tools/survey.py scan/Room walls` controleert dat de vier wanden uit de mesh op het stelsel liggen. Met `box` en `map` meet je een meubel op: omtrek, hoogte en een hoogtekaart van bovenaf.
- `node tools/export-layout.js > reference/layout.json` en daarna `python3 -I tools/measure.py scan/Room reference/layout.json reference/measure` tekenen de gemodelleerde grondvlakken over de mesh, per hoogteband. Elk grondvlak hoort op zijn meubel te vallen.
- `python3 -I tools/mosaic.py scan/Room reference/mosaic` bakt per wand en voor de vloer een rechtgetrokken fotomozaïek op 240 px per meter. Daaruit zijn deur, raam, schilderijen, kleed en mat afgelezen.
- `python3 -I tools/bake_textures.py scan/Room public/baked` snijdt elk schilderij, de ordnerrij, het prikbord op de kastdeur en het uitzicht uit de best passende scanfoto. De regio's staan bovenin dat bestand.

Een meubel verplaatsen of toevoegen in `src/layout.js` begint dus bij een meting met `survey.py`, niet bij een schatting uit een foto.

## Controleren

Met de site draaiend:

- `node tools/screenshot.js https://knutselkamer.test/ beeld.png` maakt een render in headless Chromium.
- `node tools/check-rearranging.js https://knutselkamer.test/ reference/rearrange` doorloopt selecteren, verslepen, draaien, herladen en terugzetten.
- `node tools/check-live-reload.js https://knutselkamer.test/` controleert dat een bronwijziging de pagina herlaadt met behoud van het standpunt.
- `node tools/check-slow-textures.js https://knutselkamer.test/ beeld.png` vertraagt de fototexturen en controleert dat het eerste beeld erop wacht.

## Publiceren

`.github/workflows/pages.yml` bouwt de site bij elke push naar `main` en zet `dist/` op GitHub Pages. De build gebruikt relatieve paden, dus de site werkt ook in een submap.

## Privacy

De texturen in `public/baked/` komen uit foto's van een echte kamer. `tools/bake_textures.py` vervaagt bij het bakken de ingelijste familiefoto's, het prikbord op de kastdeur en de etiketten op de ordners (`BLUR_BEFORE_PUBLISHING`), zodat personen, briefjes en etiketten niet herkenbaar in de site of in git staan. De ruwe scan in `scan/` bevat de onbewerkte foto's en het adres en blijft buiten git.
