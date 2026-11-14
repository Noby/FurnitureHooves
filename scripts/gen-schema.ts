/**
 * Generates docs/params.schema.json from the zod schema – the contract
 * shared with the future Autodesk Fusion add-in (same keys, ranges, defaults).
 * Run: npm run schema
 */
import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DEFAULT_PARAMS } from '../src/core/defaults';
import { bootParamsSchema } from '../src/core/params';

const schema = zodToJsonSchema(bootParamsSchema, {
  name: 'BootParams',
  $refStrategy: 'none',
}) as { definitions: { BootParams: { properties: Record<string, Record<string, unknown>> } } };

const props = schema.definitions.BootParams.properties;
for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
  if (props[key]) props[key].default = value;
}

const out = {
  title: 'Furniture Hooves – boot parameters',
  description:
    'All dimensions in millimetres. Derived rules (corner wall, screw fit, recess depth) are implemented in src/core/validate.ts.',
  ...schema,
};

writeFileSync(
  new URL('../docs/params.schema.json', import.meta.url),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('docs/params.schema.json written');
