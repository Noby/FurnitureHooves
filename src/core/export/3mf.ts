import { strToU8, zipSync } from 'fflate';
import type { BootMesh } from '../generateBoot';

type MeshData = Pick<BootMesh, 'positions' | 'indices'>;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const num = (v: number) => (Math.round(v * 1e5) / 1e5).toString();
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function modelXml(mesh: MeshData, name: string): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `<metadata name="Title">${escapeXml(name)}</metadata>`,
    '<metadata name="Application">Furniture Hooves</metadata>',
    `<resources><object id="1" name="${escapeXml(name)}" type="model"><mesh><vertices>`,
  ];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    parts.push(`<vertex x="${num(p[i])}" y="${num(p[i + 1])}" z="${num(p[i + 2])}"/>`);
  }
  parts.push('</vertices><triangles>');
  const t = mesh.indices;
  for (let i = 0; i < t.length; i += 3) {
    parts.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  }
  parts.push('</triangles></mesh></object></resources><build><item objectid="1"/></build></model>');
  return parts.join('\n');
}

/** 3MF package (zip) with a single mesh object, units in mm. */
export function meshTo3mf(mesh: MeshData, name = 'boot'): Uint8Array {
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      _rels: { '.rels': strToU8(RELS) },
      '3D': { '3dmodel.model': strToU8(modelXml(mesh, name)) },
    },
    { level: 6 },
  );
}
