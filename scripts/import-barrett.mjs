// Imports the standard Barrett M82A1 model from a locally installed Point Blank client.
// Usage: node scripts/import-barrett.mjs "C:\\Path\\To\\Point Blank" [tools checkout]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const client = path.resolve(process.argv[2] || "C:/Program Files (x86)/TAM Game/Point Blank");
const tools = path.resolve(process.argv[3] || path.join(root, "../pb-extract-tools-public-main"));
const packDir = path.join(client, "Pack");
const packs = fs.readdirSync(packDir)
  .filter((name) => /^Weapon_Barrett_M82A1(?:_.*)?\.i3Pack$/i.test(name))
  .map((name) => name.replace(/\.i3Pack$/i, ""))
  .sort((a, b) => (a === "Weapon_Barrett_M82A1" ? -1 : b === "Weapon_Barrett_M82A1" ? 1 : a.localeCompare(b)));
if (!packs.length) throw new Error(`Barrett paketi tapılmadı: ${packDir}`);

process.env.PB_CLIENT_CROSS = client;
process.env.PB_ASSETS = path.join(root, "public/assets");
process.env.PB_WEB = root;
process.env.PB_SERVER = root;
process.env.PB_EXTRACTED = path.join(root, "extracted");

const { exportWeapon } = await import(pathToFileURL(path.join(tools, "export-model.mjs")).href);
let entry = null;
const failures = [];
for (const pack of packs) {
  try {
    entry = exportWeapon({
      pack,
      id: "105032",
      kind: "sniper",
      packDir,
      extra: {
        itemId: 105032,
        itemIds: [105032],
        inServer: true,
        classType: 5,
        family: "barrett",
        animSet: "Barrett",
        client: "tam-tr",
        sourceVersion: "TAM Game Point Blank",
      },
    }, { outRoot: path.join(root, "public/assets"), maxTex: 1024 });
    console.log(`Uyğun Barrett paketi: ${pack}`);
    break;
  } catch (error) {
    failures.push(`${pack}: ${error.message}`);
  }
}
if (!entry) throw new Error(`Heç bir Barrett variantının geometri formatı dəstəklənmədi:\n${failures.join("\n")}`);

const indexFile = path.join(root, "public/assets/weapons/models/index.json");
const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
const weapons = Array.isArray(index.weapons) ? index.weapons : [];
const at = weapons.findIndex((x) => String(x.id) === "105032");
if (at >= 0) weapons[at] = entry;
else weapons.push(entry);
weapons.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
index.generated = new Date().toISOString();
index.weapons = weapons;
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
console.log(`Barrett M82A1 əlavə edildi: ${entry.file} (${entry.tris} tris, ${entry.textures} tekstura)`);
