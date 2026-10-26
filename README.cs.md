# pi-readme-generator

> Pi plugin pro generování README řízené skillem: README píše agent, plugin dodává fakta a bezpečný commit pouze souboru README.

## Co umí

- **`/readme-gen [pokyny]`** — předá požadavek agentovi s odkazem na přibalený skill `readme-generator`. Agent projekt analyzuje, zeptá se na preference, sám napíše/aktualizuje `README.md` a automaticky ho commitne. Volitelný textový argument se předá agentovi (např. `/readme-gen česky, přidej badges`).
- **Nástroj `readme_generator`** — tři akce:
  - `analyze` — fakta o projektu pouze pro čtení (jazyk, framework, package manager, entry pointy, skripty, `hasReadme`, `hasGit`).
  - `init-git` — zajistí lokální git repozitář s identitou `mastnacek <mastnacek@gmail.com>`.
  - `frontmatter` — normalizuje strukturu frontmatteru.
  - `scaffold` — zapíše generickou šablonu `README.md`; existující README odmítne přepsat, pokud není `force: true`.
  - `commit` — stage a commit **pouze souboru README** pod identitou repozitáře (při absenci gitu automaticky inicializuje lokální git).
- **Skill `readme-generator`** — workflow, který agent dodržuje: analýza → respekt k existujícímu README → dotaz na preference → psaní → ověření → automatický commit.

## Bezpečnostní pravidla

- Nikdy `git add -A` — nesouvisející rozpracované soubory zůstanou nedotčené.
- Nikdy nemění git config — použije se vaše skutečná identita.
- Automaticky inicializuje lokální git, pokud chybí — spustí `git init` a nastaví lokální identitu `mastnacek <mastnacek@gmail.com>`. Čistě lokálně: nikdy nevytváří remote ani nepushuje.
- Šablona nikdy tiše nepřepíše existující README.

## Vývoj

```bash
npx tsc --noEmit   # typecheck
npm test           # kompilace + node --test dist/test/*.test.js
```
