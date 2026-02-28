# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Runtime Rule Mapping

The tracker now dynamically pulls location requirement rules from the
[Celeste-LevelData-Parser](https://github.com/matthewjaykoster/Celeste-LevelData-Parser)
JSON file.  When the app initializes it will fetch the latest
`CelesteLevelData.json` and translate each rule into the internal logic keys
already used by the tracker.

To support offline development the same JSON file is included in the `public`
folder (a copy of the file lives at `./public/CelesteLevelData.json`).  If
network access fails the tracker will automatically fall back to this local
copy.  You can refresh the copy by replacing it with an updated version from
the parser repository.

Unmapped mechanics (gems, clutter, etc.) are intentionally ignored since they
have no effect on reachability logic.

### Keys and B/C sides

- The requirement generator now understands key names even when the JSON
  omits the chapter/side prefix.  A small set of patterns such as "Front Door
  Key", "Search Key 1", and "2500 M Key" are recognised and mapped to the
  appropriate `hasXXXKey` logic keys.
- Rules from A‑side levels are propagated to the corresponding B and C side
  locations if the JSON file does not explicitly list them.  This ensures you
  get the same gating on side levels even when the data source only contains
  the original A entries.

### Server toggles and sanit(y) options

Several gameplay options are now surfaced as toggles in the tracker and are
populated automatically from the Archipelago slot data when you connect:

- **B‑side / C‑side inclusion** – these can be toggled independently; the old
  combined "include sides" flag will set both.
- **Checkpointsanity** (already existed) as well as **binosanity, keysanity,
  gemsanity, carsanity**.  These options do not affect logic directly but are
  shown in the UI so you can verify what the server is telling the tracker.

When connecting to a game the tracker reads the matching `slot_data` keys and
logs the state of each toggle in the console.  You can still change them
manually via the Logic Options panel.

### Limitations

The JSON file contains a minimal set of requirements derived from the
vanilla levels; it does **not** encode every shortcut or softlock that exists
in the game.  In particular, some checks are reachable via alternate paths
that are not represented in the rules, so the tracker may conservatively
mark them as inaccessible until you obtain the listed mechanics.  Handling
those shortcuts would require a more sophisticated graph analysis and is
outside the current scope, but the basic gating provided by the rules is
usually sufficient for logic checks.

An npm helper script is also available for inspecting the rule set locally:

```bash
npm run check-rules
```

> **Note on saved logic:** The tracker caches any manually edited logic
> conditions in `localStorage` under the key `celeste-location-logic`.  If
> you have previously run the app before automatic rules were available you
> may still have entries set to the default `noCondition` placeholder.  These
> will be treated as custom logic and prevent the JSON‑derived rules from
> taking effect.  To reset the logic and allow automatic conditions to apply
> again, either clear that key from your browser storage or run in the
> console:
>
> ```js
> localStorage.removeItem('celeste-location-logic');
> ```

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
