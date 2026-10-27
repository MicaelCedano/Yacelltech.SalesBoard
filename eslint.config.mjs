import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // La regla nueva sigue visible como aviso en los efectos de sincronización existentes.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
]);
