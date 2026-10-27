// Generates PNG icons from public/favicon.svg (run once: npm run icons)
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/favicon.svg')
// Maskable icons need a safe zone: square background, mascot scaled down
const maskable = Buffer.from(
  svg
    .toString()
    .replace('rx="120"', 'rx="0"')
    .replace('translate(76 96) scale(3)', 'translate(136 146) scale(2)'),
)

await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(maskable).resize(512, 512).png().toFile('public/icon-maskable-512.png')
// iOS adds its own rounded corners
await sharp(maskable).resize(180, 180).flatten({ background: '#ffb7cf' }).png().toFile('public/apple-touch-icon.png')
console.log('icons generated')
