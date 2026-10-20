// Prepara o CarConcept (Khronos, CC-BY 4.0) para o simulador:
// variante grafite, sem logos e tudo comprimido. As peças de PPF são separadas no shader (assets/js/estudio3d.js).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt, textureCompress, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const [entrada, saida, pastaTex] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(entrada);
const raiz = doc.getRoot();

// 1) variante "Graphite" no lugar das mapeadas, depois some com a extensão de variantes
const variantes = raiz.listExtensionsUsed().find((e) => e.extensionName === 'KHR_materials_variants');
for (const mesh of raiz.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const lista = prim.getExtension('KHR_materials_variants');
    if (!lista) continue;
    const alvo = lista.listMappings().find((m) => m.listVariants().some((v) => /graphite/i.test(v.getName())));
    if (alvo) prim.setMaterial(alvo.getMaterial());
    prim.setExtension('KHR_materials_variants', null);
  }
}
variantes?.dispose();

// 1b) logos da Khronos e da 3D Commerce nas texturas: pneu liso e textura da placa apagada
const liso = (r, g, b) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r, g, b } } }).png().toBuffer();
const matPorNome = (n) => raiz.listMaterials().find((m) => m.getName() === n);
const pneu = matPorNome('Tireside');
pneu.getBaseColorTexture().setImage(await liso(26, 26, 27));
pneu.getNormalTexture().setImage(await liso(128, 128, 255));
matPorNome('License').getBaseColorTexture().setImage(await liso(0, 0, 0));

// 2) fora: placa e emblema (logos da Khronos), motor escondido
for (const node of raiz.listNodes()) {
  if (/License|SteeringEmblem|^Engine$/i.test(node.getName())) {
    node.getMesh()?.dispose();
    node.dispose();
  }
}

// 4) limpeza e compressão
await doc.transform(
  dedup(),
  prune(),
  weld(),
  reorder({ encoder: MeshoptEncoder }),
  quantize(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

if (pastaTex) {
  fs.mkdirSync(pastaTex, { recursive: true });
  raiz.listTextures().forEach((t, i) => fs.writeFileSync(`${pastaTex}/tex${i}.${t.getMimeType().split('/')[1]}`, t.getImage()));
}
await io.write(saida, doc);
console.log('ok', (fs.statSync(saida).size / 1024 / 1024).toFixed(2), 'MB');
