# pi-readme-generator

![Language](https://img.shields.io/badge/Language-TypeScript-blue) ![Package Manager](https://img.shields.io/badge/Package%20Manager-npm-orange) ![Git](https://img.shields.io/badge/Version%20Control-Git-red) ![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)

> Plugin pro agenta Pi, který automaticky analyzuje projekt, generuje README.md a spravuje git commity.

## Obsah

- [Instalace](#instalace)
- [Použití](#použití)
- [Funkce](#funkce)
- [Struktura projektu](#struktura-projektu)
- [Vývoj](#vývoj)
- [Testování](#testování)
- [Konfigurace](#konfigurace)
- [Přispívání](#přispívání)
- [Licence](#licence)

## Instalace

```bash
# Instalace závislostí
npm install
```

## Použití

Po načtení pluginu v agentovi Pi můžete používat následující příkazy:

**Jediný příkaz pro vše:**
```
/readme-gen                    # Kompletní workflow: analýza → README → git init → commit
/readme-gen "vaše zpráva"      # Stejné s vlastní zprávou commitu
```

**Nástroj pro modely (agent-driven):**
```json
{
  "name": "readme_generator",
  "arguments": {
    "projectRoot": "/cesta/k/vasemu/projektu",
    "customMessage": "feat: přidání autentizace"
  }
}
```

### Co se stane při spuštění

1. **Analýza (10%)** — Prohledá projekt a zjistí jazyk, framework, správce balíčků, vstupní body, testy/konfigurace
2. **Generování README (40-60%)** — Vytvoří komplexní README.md s badges, obsahem, instalací, použitím, funkcemi, stromem projektu, vývojem, testováním, konfigurací, přispíváním a licencí
3. **Inicializace Gitu (70-75%)** — Pokud neexistuje, inicializuje git repozitář a nastaví uživatele
4. **Git Commit (80-90%)** — Přidá všechny soubory, vytvoří strukturovaný commit s emoji:
   - 🎉 První commit
   - 📝 Dokumentace (README)
   - ✨ Nová funkce (zdrojové kódy)
   - ⚙️ Konfigurace
   - 🧪 Testy
   - 🔧 Údržba
5. **Hotovo (100%)** — Zobrazí výsledek v TUI

## Funkce

- **Automatická analýza projektu** — Detekuje jazyk (TypeScript, Python, Rust, Go, Java...), framework (React, Vue, FastAPI, Tauri, Next.js...), package manager, entry points
- **Generování profesionálního README** — Badges, TOC, instalace, použití, funkce, strom projektu, vývoj, testování, konfigurace, přispívání, licence
- **Správa Gitu** — Auto-inicializace repozitáře, staging, commity s conventional messages a emoji
- **TUI stav v reálném čase** — Progress bar a zprávy během celého procesu
- **Jednoduché rozhraní** — Jeden příkaz `/readme-gen` pro kompletní workflow
- **Model-driven tool** — Nástroj `readme_generator` pro použití agentem
- **Lokalizace** — Čeština/angličtina pro UI

## Struktura projektu

```
pi-readme-generator/
├── index.ts                          # Kořen kompozice (subagent guard)
├── src/
│   ├── shared/
│   │   ├── state.ts                  # PluginState (enabled, lang)
│   │   └── i18n.ts                   # EN/CS string tables
│   ├── slices/
│   │   ├── commands/index.ts         # /pi-readme-generator lang <en|cs>
│   │   ├── tools/index.ts            # pi_readme_generator_status tool
│   │   └── readme-generator/
│   │       ├── types.ts              # Rozhraní (ProjectAnalysis, ProgressStage, GitCommitInfo)
│   │       ├── analyzer.ts           # ProjectAnalyzer - detekce jazyka, frameworku, package manageru
│   │       ├── readme-builder.ts     # ReadmeBuilder - generování README
│   │       ├── git-manager.ts        # GitManager - init, stage, commit s emoji
│   │       ├── engine.ts             # ReadmeGeneratorEngine - orchestrace workflow
│   │       ├── commands.ts           # /readme-gen (TUI progress)
│   │       ├── tools.ts              # readme_generator tool (model-facing)
│   │       └── index.ts              # Exporty slicu
│   └── pipeline/                     # (rezervováno)
└── test/                             # Základní testy
```

## Vývoj

```bash
# Kompilace TypeScriptu
npx tsc --noEmit

# Spuštění testů
npm test
```

### Architektura

Plugin používá **Vertical Slice Architecture (VSA)**:
- Každý slice je izolovaný (commands, tools, readme-generator)
- Sdílený kód pouze v `src/shared/`
- Kořen kompozice v `index.ts` registruje všechny slicy

## Testování

```bash
npm test
```

## Konfigurace

Klíčové konfigurační soubory:
- `package.json` — závislosti, skripty, metadata
- `tsconfig.json` — TypeScript konfigurace (ES2022, NodeNext, strict)

## Přispívání

Příspěvky jsou vítány!

1. Forkněte repozitář
2. Vytvořte feature branch (`git checkout -b feature/skvele-novy-funkce`)
3. Commitněte změny (`git commit -m "feat: přidání skvělé funkce"`)
4. Pushejte do branch (`git push origin feature/skvele-novy-funkce`)
5. Otevřete Pull Request

## Licence

Tento projekt je licencován pod MIT licencí - viz soubor [LICENSE](LICENSE) pro detaily.

## Poděkování

- Vytvořeno s [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent)
- README vygenerováno [pi-readme-generator](https://github.com/mastnacek/pi-readme-generator)

---

*Vygenerováno s ❤️ [pi-readme-generator](https://github.com/mastnacek/pi-readme-generator)*