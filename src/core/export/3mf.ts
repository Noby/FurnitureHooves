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

/** Slicer settings stored in the 3MF (applied per object by PrusaSlicer). */
export interface SlicerSettings {
  /** infill [%] */
  infill: number;
  perimeters: number;
  solidLayers: number;
}

/**
 * PrusaSlicer per-object configuration (Metadata/Slic3r_PE_model.config).
 * Object-level metadata entries override the print profile for that object.
 */
export function prusaObjectConfig(name: string, triangles: number, s: SlicerSettings): string {
  const meta = (key: string, value: string | number) =>
    `    <metadata type="object" key="${key}" value="${escapeXml(String(value))}"/>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    ' <object id="1" instances_count="1">',
    meta('name', name),
    meta('fill_density', `${Math.round(s.infill)}%`),
    meta('perimeters', Math.round(s.perimeters)),
    meta('top_solid_layers', Math.round(s.solidLayers)),
    meta('bottom_solid_layers', Math.round(s.solidLayers)),
    `  <volume firstid="0" lastid="${Math.max(0, triangles - 1)}">`,
    `   <metadata type="volume" key="name" value="${escapeXml(name)}"/>`,
    '  </volume>',
    ' </object>',
    '</config>',
  ].join('\n');
}

/** 3MF package (zip) with a single mesh object, units in mm (+ optional slicer settings). */
export function meshTo3mf(mesh: MeshData, name = 'boot', settings?: SlicerSettings): Uint8Array {
  const files: Record<string, Uint8Array | Record<string, Uint8Array>> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    _rels: { '.rels': strToU8(RELS) },
    '3D': { '3dmodel.model': strToU8(modelXml(mesh, name)) },
  };
  if (settings) {
    files.Metadata = {
      'Slic3r_PE_model.config': strToU8(prusaObjectConfig(name, mesh.indices.length / 3, settings)),
    };
  }
  return zipSync(files, { level: 6 });
}
