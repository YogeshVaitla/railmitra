// Deterministic vector source; no generated placeholder graphics.
// Requires sharp (available in the Expo image toolchain / development environment).
const fs=require('node:fs');
const sharp=require('sharp');
const source=fs.readFileSync('assets/images/railmitra-mark.svg');
(async()=>{
  await sharp(source).flatten({background:'#FFF8F3'}).png().toFile('assets/images/icon.png');
  await sharp(source).png().toFile('assets/images/android-icon-foreground.png');
  await sharp({create:{width:1024,height:1024,channels:4,background:'#FFF8F3'}}).png().toFile('assets/images/android-icon-background.png');
  await sharp(Buffer.from(source.toString().replaceAll('#A83D16','#000000'))).png().toFile('assets/images/android-icon-monochrome.png');
  await sharp(source).png().toFile('assets/images/splash-icon.png');
  await sharp(source).resize(512).flatten({background:'#FFF8F3'}).png().toFile('assets/images/play-icon.png');
  await sharp(source).resize(48).flatten({background:'#FFF8F3'}).png().toFile('assets/images/favicon.png');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
