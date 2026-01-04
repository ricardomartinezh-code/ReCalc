import fs from "node:fs/promises";
import process from "node:process";
import { neon } from "@neondatabase/serverless";

const slug = process.argv[2] ?? "unidep";
const rulesPath = process.argv[3] ?? "scripts/benefit_rules.json";
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL no configurado.");
  process.exit(1);
}

const sql = neon(connectionString);
const raw = await fs.readFile(rulesPath, "utf8");
const parsed = JSON.parse(raw);
const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];

const emptyConfig = {
  version: 1,
  enabled: true,
  defaults: { beneficio: { rules: [] } },
  priceOverrides: [],
  materiaOverrides: [],
  shortcuts: [],
  programAvailability: [],
  adjustments: [],
};

const existing = await sql`
  SELECT config
  FROM admin_config
  WHERE slug = ${slug}
  LIMIT 1;
`;
const rows = Array.isArray(existing) ? existing : existing?.rows ?? [];
const currentConfig = rows.length ? rows[0]?.config ?? emptyConfig : emptyConfig;
const nextConfig = {
  ...emptyConfig,
  ...currentConfig,
  defaults: {
    ...emptyConfig.defaults,
    ...(currentConfig?.defaults ?? {}),
    beneficio: {
      ...emptyConfig.defaults.beneficio,
      ...(currentConfig?.defaults?.beneficio ?? {}),
      rules,
    },
  },
};

await sql`
  INSERT INTO admin_config (slug, config, updated_by)
  VALUES (${slug}, ${nextConfig}, ${"script"})
  ON CONFLICT (slug)
  DO UPDATE SET config = EXCLUDED.config,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW();
`;

console.log(`Updated benefit rules for ${slug}. rules=${rules.length}`);
