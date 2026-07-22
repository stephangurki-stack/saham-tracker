import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(dir, '..', 'public', 'icon-source.svg')
const outDir = path.join(dir, '..', 'public')

for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, `pwa-${size}x${size}.png`))
  console.log(`generated pwa-${size}x${size}.png`)
}
