# Zadání: Furniture Hooves – webový generátor nasouvacích „bot“ na nohy nábytku

## 1. Kontext a cíl

Autor (Petr Václavík) publikuje na Printables model **Practical Furniture Riser "Boot" – 50x50**
(https://www.printables.com/model/1409520-practical-furniture-riser-boot-50x50).
Jde o nasouvací „botu“ (kopyto) na nohu nábytku, která nábytek zvedne (typicky o 8 mm),
aby pod něj zajel robotický vysavač. Má volitelný otvor pro fixační šroub.

Protože se nohy nábytku liší rozměry i tvarem, chceme **webovou aplikaci**, kde si uživatel:

1. zadá rozměry a tvar nohy nábytku,
2. upraví parametry kopyta podle svých potřeb (zvýšení, tloušťka stěn, výška objímky, šroub…),
3. uvidí **živou 3D vizualizaci**,
4. stáhne hotový model pro 3D tisk (STL / 3MF).

Do budoucna vznikne i **skript/add-in pro Autodesk Fusion**, proto musí být geometrie a parametry
navrženy tak, aby šly snadno přenést mimo React (viz kap. 7).

## 2. Technologie

- **React 18+ + TypeScript + Vite**
- **3D vizualizace:** `three` + `@react-three/fiber` + `@react-three/drei` (OrbitControls, Grid, Environment)
- **Geometrie / CSG:** `manifold-3d` (WASM) – robustní booleovské operace, garantuje vodotěsné (manifold) sítě vhodné pro tisk.
  Generování běží ve **Web Workeru**, aby UI nezamrzalo.
- **Validace parametrů:** `zod` (jedno schéma = jediný zdroj pravdy pro UI, validaci, URL i budoucí Fusion skript)
- **Export:** binární STL (vlastní zápis nebo `three/examples/jsm/exporters/STLExporter`), 3MF (manifold-3d / jednoduchý vlastní zápis)
- **Styling:** Tailwind CSS s tokeny z kap. 5.6 (vizuální styl „Blueprint“)
- **Testy:** Vitest (unit testy geometrie), Playwright volitelně pro smoke test UI
- **Lint/format:** ESLint + Prettier
- **Nasazení:** čistě statická aplikace (GitHub Pages / Vercel / Netlify), žádný backend

## 3. Parametry

Všechny rozměry v **mm**. Výchozí hodnoty odpovídají existujícímu modelu 50×50
Všechny výchozí hodnoty jsou na jednom místě v souboru `defaults.ts` a uživatel je může měnit.

### 3.1 Noha nábytku
| Parametr | Klíč | Výchozí | Rozsah | Poznámka |
|---|---|---|---|---|
| Tvar průřezu | `legShape` | `rectangle` | `rectangle` \| `round` | Obdélník/čtverec, nebo kruh |
| Šířka nohy | `legWidth` | 50 | 10–200 | U kruhu = průměr |
| Hloubka nohy | `legDepth` | 50 | 10–200 | Jen pro obdélník; přepínač „čtverec“ zamkne hloubku = šířka |
| Rádius rohů nohy | `legCornerRadius` | 0 | 0 – min(W,D)/2 | Zaoblené hrany nohy |
| Zúžení nohy (volitelné) | `legTaper` | 0 | 0–5° | Kuželovité nohy; fáze 2 |

### 3.2 Kopyto (bota)
| Parametr | Klíč | Výchozí | Rozsah | Poznámka |
|---|---|---|---|---|
| Tolerance (celková) | `tolerance` | 1 | 0–6 | Vnitřní rozměr = noha + tolerance (tj. tolerance/2 na každou stranu). Nový nábytek má přesné rozměry → menší tolerance; starší, opotřebovaný → větší. V UI krátká nápověda k tomu |
| Zvýšení (tloušťka dna) | `lift` | 8 | 1–100 | O kolik se nábytek zvedne |
| Tloušťka stěny | `wallThickness` | 3 | 0.8–10 | Doporučit násobky šířky extruze (0.4 mm) |
| Výška objímky | `sleeveHeight` | 20 | 3–150 | Jak vysoko bota obepíná nohu (měřeno od dna nohy) |
| Vnější rádius rohů | `outerCornerRadius` | 1 | 0–… | Nesmí vytvořit stěnu tenčí než min. tloušťka |
| Sražení spodní hrany | `bottomChamfer` | 0.6 | 0–3 | Kvůli „elephant foot“ a vzhledu |
| Sražení horní hrany objímky | `topChamfer` | 0.4 | 0–2 | Usnadní nasouvání (vnitřní náběh) |

### 3.3 Šroub (volitelné)
| Parametr | Klíč | Výchozí | Poznámka |
|---|---|---|---|
| Otvor pro šroub | `screwEnabled` | true | Otvor ve dně ve středu |
| Průměr otvoru | `screwHoleDiameter` | 3 | |
| Zahloubení | `screwHead` | `countersunk` | `none` \| `countersunk` (90°) \| `counterbored` |
| Průměr hlavy | `screwHeadDiameter` | 6 | |
| Hloubka válcového zahloubení | `screwHeadDepth` | 3 | jen pro `counterbored` |

### 3.4 Volitelné doplňky (fáze 2)
- **Kapsa na plst / gumu** ve spodní straně (`padRecess`: hloubka, okraj).
- **Odlehčení dna** (žebrování / dutina) pro velká zvýšení – šetří materiál.
- **Zkosený náběh pro vysavač** – vnější obvod dna se zkosením, aby robot snáz najel.
- **Více kusů na jedné podložce** (export N kusů rozmístěných vedle sebe).

### 3.5 Validace (zod + odvozená pravidla)
- Vnější rádius ≤ (vnější rozměr / 2) a nesmí zeslabit stěnu pod 0.8 mm.
- `screwHeadDiameter` > `screwHoleDiameter`; zahloubení ≤ `lift` − 1 mm.
- Otvor pro šroub musí vejít do vnitřní plochy.
- Neplatné kombinace → červená hláška u pole, model se negeneruje, poslední platný zůstává zobrazen.
- Měkká varování (žlutá): tenká stěna < 1.2 mm, velké zvýšení bez odlehčení, tolerance 0 („nemusí jít nasadit“).

## 4. Geometrie (logika modelu)

Model je orientovaný pro tisk: **dno na podložce (Z = 0)**, otevřená strana nahoru – bez podpor.

```
vnitřní profil  = profil nohy offsetnutý o tolerance / 2
vnější profil   = vnitřní profil offsetnutý o wallThickness (zaoblení outerCornerRadius)
těleso          = extrude(vnější profil, lift + sleeveHeight)
dutina          = extrude(vnitřní profil, sleeveHeight) posunutá na Z = lift
výsledek        = těleso − dutina − otvor šroubu − zahloubení − sražení
```

- Rohy: kruhové oblouky dostatečně jemné (segmentů dle velikosti rádiusu, min. 32 na kruh).
- Výsledek musí být **manifold** (test to ověřuje).
- Generátor je **čistá funkce** `generateBoot(params: BootParams): Mesh` bez závislosti na Reactu / DOM.

## 5. UI / UX

Rozvržení: vlevo (na mobilu nahoře) panel parametrů, vpravo 3D náhled.

### 5.1 Panel parametrů
- Sekce: **Noha nábytku** → **Kopyto** → **Šroub** → **Pokročilé** (sbalitelná).
- Každé pole: číselný vstup + slider, jednotka „mm“, tooltip s vysvětlením (i malý obrázek/ikona, co parametr znamená).
- Přepínač tvaru nohy (čtverec / obdélník / kruh) s ikonami.
- **Předvolby**: „50×50 (originál z Printables)“, „40×40“, „Kulatá Ø 35“, „IKEA-like 45×45“ … (uložené v `presets.ts`).
- Tlačítko **Reset na výchozí**.

### 5.2 3D vizualizace
- Živá aktualizace s debounce (~150 ms), generování ve Workeru, indikátor „počítám…“.
- OrbitControls, mřížka podložky, automatické zarámování modelu.
- **Průhledný „duch“ nohy nábytku** zasunutý v kopytu (přepínatelný) – aby bylo vidět, jak bota sedí.
- Přepínač **řez** (clipping plane v polovině) – ukáže tloušťku dna, stěny a zahloubení šroubu.
- Volitelně kóty (vnější rozměr, celková výška, zvýšení).
- Světlý i tmavý motiv; barva modelu oranžová (ve stylu Printables/Prusa).

### 5.3 Informace a export
- Souhrn: vnější rozměry, vnitřní rozměry, celková výška, **objem a odhad hmotnosti** (PLA 1.24 g/cm³, PETG 1.27 g/cm³ – výběr materiálu).
- Tlačítka **Stáhnout STL** a **Stáhnout 3MF**; název souboru obsahuje parametry, např. `boot_50x50_lift8.stl`.
- Výběr počtu kusů (1–8) – stáhne se jeden soubor s kusy rozmístěnými vedle sebe (fáze 2).
- Tip pro tisk (výplň dle zatížení, doporučení PETG pro těžký nábytek).

### 5.4 Sdílení
- Parametry se ukládají do **URL query** (`?w=50&d=50&lift=8…`) → odkaz lze sdílet.
- Poslední nastavení v `localStorage` (obalit try/catch).
- Odkaz na původní model na Printables.

### 5.5 Jazyk
- **Čeština a angličtina** (jednoduché i18n přes JSON slovníky, přepínač v hlavičce, výchozí dle prohlížeče).

### 5.6 Vizuální styl – „Blueprint“ (schválená varianta A)

Referenční návrh: https://claude.ai/artifact/TcpLyUWQs3fcjkUjmr5wbT (artboard **A · Blueprint**).
Světlý, čistý, technický styl. Žádné gradienty, emoji ikony ani výrazné stíny.

**Design tokeny** (definuj jako CSS proměnné / Tailwind theme v `src/ui/theme.css`):

| Token | Hodnota | Použití |
|---|---|---|
| `--bg` | `#F4F6F8` | pozadí stránky |
| `--surface` | `#FFFFFF` | karty, hlavička, vstupy |
| `--border` | `#DDE2E8` | okraje karet |
| `--border-input` | `#CBD2DA` | okraje vstupů a sekundárních tlačítek |
| `--grid-line` | `#E8ECF0` | mřížka 24 × 24 px v pozadí 3D náhledu |
| `--text` | `#111827` | hlavní text, aktivní přepínače (tmavé pozadí) |
| `--text-2` | `#3A4350` | popisky polí |
| `--text-muted` | `#5B6470` | jednotky, malé nadpisy, čísla sekcí |
| `--accent` | `#C2410C` | primární tlačítko, aktivní stav, posuvníky (`accent-color`) |
| `--accent-soft` | `#FFF4ED` / text `#9A3412` | pozadí vybrané volby (např. tvar nohy) |
| model – horní plocha / boky | `#F2914F` / `#D8622A` / `#B84D1A` | barva kopyta ve 3D (MeshStandardMaterial ≈ `#E4773A`) |
| duch nohy | `#94A3B8`, průhlednost ~0.2, čárkovaný obrys | |
| kóty | `#1F2937`, zvýšení zvýrazněné `#9A3412` | |

**Typografie:** `IBM Plex Sans` (400/500/600/700) pro UI, `IBM Plex Mono` (400/500/600) pro všechna čísla,
jednotky, kóty, štítky ve verzálkách (11 px, `letter-spacing: 0.06em`) a názvy souborů. Načítat z Google Fonts.
Čísla zobrazovat s desetinnou čárkou v CS (`55,8`), s tečkou v EN.

**Tvary a rozměry:** zaoblení karet 10 px, vstupů a tlačítek 6–8 px; vstup 36 px vysoký, tlačítka ≥ 44 px
(dotykové cíle); mezery 8 / 12 / 16 / 20 px; okraje 1 px, aktivní okraj 1.5 px v barvě akcentu.

**Rozložení (desktop ≥ 1024 px):**
- Hlavička: logo + „Furniture Hooves“ a podtitul „GENERÁTOR KOPYT NA NÁBYTEK“ (mono), navigace
  (Generátor · Jak měřit nohu · Printables ↗), přepínač CS/EN.
- Levý sloupec (320–380 px): karta *Předvolba* a karty sekcí *Noha nábytku (01)*, *Kopyto (02)*, *Otvor pro šroub*.
  Každé pole = popisek vlevo, číselný vstup s jednotkou vpravo (mono, zarovnání doprava), u hlavních rozměrů pod ním posuvník.
- Pravý sloupec: karta 3D náhledu s mřížkou, nahoře lišta s názvem souboru (`kopyto_50x50_lift8 · ISO`)
  a přepínači *Noha* / *Řez* / *Kóty* / vycentrovat; dole v náhledu tip k tisku.
- Pod náhledem pruh se 4 hodnotami (vnější rozměr, vnitřní rozměr, celková výška, objem · hmotnost).
- Akční lišta: počet kusů, *Kopírovat odkaz*, *Stáhnout 3MF* (obrysové), *Stáhnout STL* (primární, oranžové).
- Mobil: sloupce se poskládají pod sebe (nejdřív náhled, pak parametry), akční lišta se zalomí.

**Přístupnost:** skutečné `<button>`, `<input>` + `<label>`, `aria-pressed` u přepínačů, `aria-label` u ikonových
tlačítek, kontrast textu ≥ 4.5 : 1 (barvy výše to splňují), viditelný focus (2 px obrys v `--accent`).

## 6. Struktura projektu

```
src/
  core/                 # ČISTÁ logika, bez Reactu – přenositelná
    params.ts           # zod schéma BootParams + typy
    defaults.ts         # výchozí hodnoty
    presets.ts
    validate.ts         # odvozená pravidla, chyby a varování
    profile.ts          # 2D profily (obdélník se zaoblením, kruh, offset)
    generateBoot.ts     # CSG pomocí manifold-3d
    export/stl.ts
    export/3mf.ts
    stats.ts            # objem, hmotnost, rozměry
  worker/
    geometry.worker.ts  # volá generateBoot, vrací pozice/indexy (transferable)
  ui/
    App.tsx
    ParamPanel/…
    Viewer/…            # R3F scéna, duch nohy, řez, kóty
    ExportBar.tsx
  i18n/cs.json, en.json
  hooks/useUrlParams.ts, useBootGeometry.ts
tests/
  generateBoot.test.ts
  validate.test.ts
docs/
  params.schema.json    # vygenerovaný JSON Schema z zod (pro Fusion skript)
```

## 7. Příprava na Autodesk Fusion (zatím neimplementovat, jen umožnit)

- `src/core` nesmí importovat nic z Reactu, DOM ani three.js (kromě exportu, pokud je nutné).
- Ze zod schématu generovat `docs/params.schema.json` (např. `zod-to-json-schema`) – stejné názvy klíčů,
  výchozí hodnoty a rozsahy použije později Python add-in pro Fusion.
- V `docs/geometry.md` popsat postup modelování krok po kroku (sketch → extrude → shell/cut → hole → chamfer),
  aby šel 1:1 zopakovat přes Fusion API.
- Volitelně: tlačítko „Exportovat parametry (JSON)“ – soubor, který později načte Fusion skript.

## 8. Testy a kvalita

- Unit testy `generateBoot` pro několik sad parametrů (výchozí, kruh, bez šroubu, extrémy rozsahů):
  - výsledná síť je manifold a má kladný objem,
  - bounding box odpovídá: X = legWidth + tolerance + 2·wallThickness, Z = lift + sleeveHeight (±0.01),
  - s šroubem je objem menší než bez šroubu.
- Testy validace (neplatné kombinace vrací chyby).
- Exportovaný STL jde znovu načíst a má očekávaný počet trojúhelníků > 0.
- `npm run build` bez chyb, `npm run lint` čistý, TypeScript `strict`.

## 9. Postup (milníky)

1. **Scaffold:** Vite + React + TS, ESLint/Prettier, Vitest, Tailwind. README s instrukcemi.
2. **Core:** schéma parametrů, výchozí hodnoty, profily, `generateBoot` s manifold-3d, testy.
3. **Viewer:** R3F scéna, Worker, live update, duch nohy, řez.
4. **Panel parametrů:** sekce, slidery, validace, předvolby, reset.
5. **Export:** STL, 3MF, statistiky (objem/hmotnost), název souboru.
6. **Sdílení a i18n:** URL parametry, localStorage, CS/EN.
7. **Fáze 2:** zúžené nohy, kapsa na plst, odlehčení dna, více kusů, kóty.
8. **Nasazení:** GitHub Actions → GitHub Pages.

Po každém milníku: spusť testy a build, krátce shrň, co je hotové, a ukaž náhled.

## 10. Akceptační kritéria (MVP = milníky 1–6)

- Uživatel zadá rozměry nohy 50×50 a s výchozími parametry dostane model odpovídající originálu z Printables.
- Změna libovolného parametru se do ~0.5 s projeví v 3D náhledu.
- Stažený STL se bez chyb načte v PrusaSliceru a nevyžaduje opravu sítě ani podpory.
- Funguje na desktopu i mobilu (responzivní layout).
- Sdílený odkaz otevře aplikaci se stejnými parametry.

## 11. Rozhodnutí autora (uzavřené otázky)
- **Výchozí hodnoty:** tloušťka stěny 3 mm, vnější rádius 1 mm, otvor pro šroub Ø 3 mm, zvýšení 8 mm. Vše je konfigurovatelné.
- **Tolerance** je celková (1 mm = 0,5 mm na každou stranu) a je konfigurovatelná – nový nábytek má přesné rozměry, starší může být opotřebovaný.
- **Název aplikace:** Furniture Hooves.
- **Kontrolní hodnoty pro výchozí nastavení 50 × 50:** vnitřní otvor 51 × 51 mm, vnější rozměr 57 × 57 mm, celková výška 28 mm.
