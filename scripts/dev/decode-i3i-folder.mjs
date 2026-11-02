import fs from "node:fs";
import path from "node:path";
import { readI3IB, decodeI3IB, encodePNG } from "../../../pb-extract-tools-public-main/i3r2/skin-glb.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: node decode-i3i-folder.mjs <input> <output>");
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.i3i$/i.test(entry.name)) continue;
  const file = path.join(input, entry.name);
  const data = fs.readFileSync(file);
  const offset = data.indexOf("I3IB");
  if (offset < 0) continue;
  const image = readI3IB(data, offset);
  const name = `${path.parse(entry.name).name}-${image.w}x${image.h}.png`;
  fs.writeFileSync(path.join(output, name), encodePNG(Buffer.from(decodeI3IB(data, image)), image.w, image.h, true));
  console.log(name);
}
