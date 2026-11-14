# Furniture Hooves

Webový generátor nasouvacích „bot“ (kopyt) na nohy nábytku pro 3D tisk – nábytek
zvedne, aby pod něj zajel robotický vysavač. Vychází z modelu
[Practical Furniture Riser "Boot" – 50x50](https://www.printables.com/model/1409520-practical-furniture-riser-boot-50x50).

Zadáte rozměry a tvar nohy, upravíte parametry kopyta, uvidíte živý 3D náhled
a stáhnete STL / 3MF. Vše běží v prohlížeči, žádný backend.

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest – geometrie, validace, export, URL
npm run lint       # ESLint
npm run build      # typecheck + produkční build do dist/
npm run schema     # vygeneruje docs/params.schema.json ze zod schématu
```

> npm ≥ 11 může blokovat install skripty (esbuild). Build funguje i bez nich,
> protože binárka esbuildu se instaluje jako optional dependency.

## Struktura

```
src/core/      čistá logika bez Reactu/DOM/three.js (hlídá ESLint) – přenositelná
  params.ts      zod schéma = jediný zdroj pravdy (UI, validace, URL, Fusion)
  defaults.ts    výchozí hodnoty (originál 50×50), materiály
  presets.ts     předvolby
  validate.ts    odvozená pravidla – chyby a varování
  profile.ts     2D profily (obdélník se zaoblením, kruh, offset)
  generateBoot.ts CSG pomocí manifold-3d → vodotěsná síť
  layout.ts      více kusů na podložce
  stats.ts       rozměry, hmotnost, název souboru
  urlCodec.ts    parametry ↔ URL query
  export/        binární STL, 3MF
src/worker/    Web Worker – generuje geometrii mimo UI vlákno
src/hooks/     useBootGeometry (debounce + worker), useUrlParams (URL + localStorage)
src/ui/        React UI (styl „Blueprint“, tokeny v theme.css), R3F náhled
src/i18n/      cs.json, en.json
docs/          params.schema.json, geometry.md (postup pro Autodesk Fusion)
```

## Funkce

- obdélníková / čtvercová / kulatá noha, zaoblené rohy nohy i kopyta
- zúžené nohy: kužel (kulatá) nebo komolý jehlan (hranatá), úhel 0–10°
- tolerance, zvýšení, stěna, výška objímky, sražení spodní hrany, náběh horní hrany
- volitelný otvor pro malý vrut (výchozí vypnutý) zespodu nebo zboku, se zahloubením pro zápustnou hlavu 90°; u bočního vrutu na slabé stěně se přidá nákružek kolem otvoru, zespodu zkosený 45° (bez podpor)
- validace (červené chyby, žlutá varování), model se při chybě nepřegeneruje
- 3D náhled: duch nohy, řez, kóty, vycentrování; světlý i tmavý motiv
- objem a hmotnost (PLA / PETG), 1–8 kusů na podložce, STL / 3MF / JSON parametrů
- sdílení přes URL (`?w=50&d=50&lift=8`), poslední nastavení v localStorage
- čeština / angličtina

## Nasazení

`.github/workflows/deploy.yml` po pushi do `main` spustí testy a build a nasadí
`dist/` na GitHub Pages (v nastavení repozitáře zvolte *Pages → Source: GitHub Actions*).
Díky `base: './'` funguje build i na Vercelu / Netlify bez úprav.

## Fáze 2 (zatím neimplementováno)

Kapsa na plst, odlehčení dna, zkosený náběh pro vysavač,
Fusion add-in nad `docs/params.schema.json`.
