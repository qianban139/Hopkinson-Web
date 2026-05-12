/**
 * 二维码生成脚本
 *
 * 用法：
 *   npx tsx scripts/genQRCode.ts                              # 默认 Vercel 域名
 *   QR_URL=https://hopkinson-lab.com npx tsx scripts/genQRCode.ts   # 自定义域名
 *   QR_NAME=qr-lab QR_URL=https://hopkinson-lab.com npx tsx scripts/genQRCode.ts
 *
 * 输出（不入构建，仅做分发素材）：
 *   public/<QR_NAME>.png   512×512 PNG，深色前景 #0A2540，白底
 *   public/<QR_NAME>.svg   矢量版本
 */

import QRCode from 'qrcode';
import { resolve } from 'node:path';

const URL_TARGET = process.env.QR_URL ?? 'https://hopkinson-bar.vercel.app';
const NAME = process.env.QR_NAME ?? 'qr-vercel';
const OUT_DIR = resolve(process.cwd(), 'public');

async function main(): Promise<void> {
  const pngPath = `${OUT_DIR}/${NAME}.png`;
  const svgPath = `${OUT_DIR}/${NAME}.svg`;

  await QRCode.toFile(pngPath, URL_TARGET, {
    width: 512,
    margin: 2,
    color: { dark: '#0A2540', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

  await QRCode.toFile(svgPath, URL_TARGET, {
    type: 'svg',
    margin: 2,
    color: { dark: '#0A2540', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

  console.log(`✓ Generated QR for ${URL_TARGET}`);
  console.log(`  PNG: ${pngPath}`);
  console.log(`  SVG: ${svgPath}`);
}

main().catch((err) => {
  console.error('Failed to generate QR code:', err);
  process.exit(1);
});
