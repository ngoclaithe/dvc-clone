/**
 * Unpack SingleFile HTML using cheerio (proper HTML parser)
 * - Extract base64 fonts/images → assets/
 * - Extract inline CSS → assets/css/
 * - Extract inline JS → assets/js/
 * - Replace data URIs with file paths
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const INPUT = path.join(__dirname, '1.html');
const OUTPUT = path.join(__dirname, 'index.html');

const FONT_DIR = path.join(__dirname, 'assets', 'fonts');
const IMG_DIR = path.join(__dirname, 'assets', 'images');
const CSS_DIR = path.join(__dirname, 'assets', 'css');
const JS_DIR = path.join(__dirname, 'assets', 'js');

// Create dirs
[FONT_DIR, IMG_DIR, CSS_DIR, JS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

console.log('Reading file...');
const htmlRaw = fs.readFileSync(INPUT, 'utf-8');
console.log(`Input size: ${(htmlRaw.length / 1024 / 1024).toFixed(2)} MB`);

// Load with cheerio
console.log('Parsing HTML...');
const $ = cheerio.load(htmlRaw, { decodeEntities: false, xmlMode: false });

let fontCount = 0;
let imgCount = 0;
let cssCount = 0;
let jsCount = 0;

// Helper: decode + save base64 data URI, return file path
function saveBase64(dataUri, prefix, targetDir) {
  // data:image/png;base64,xxxxx or data:font/woff2;base64,xxxxx
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;

  const mimeType = match[1];
  const base64 = match[2];

  // Determine extension
  let ext = 'bin';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (mimeType.includes('svg')) ext = 'svg';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('ico') || mimeType.includes('x-icon')) ext = 'ico';
  else if (mimeType.includes('woff2')) ext = 'woff2';
  else if (mimeType.includes('woff')) ext = 'woff';
  else if (mimeType.includes('truetype') || mimeType.includes('ttf')) ext = 'ttf';
  else if (mimeType.includes('opentype') || mimeType.includes('otf')) ext = 'otf';
  else if (mimeType.includes('eot')) ext = 'eot';

  imgCount++;
  const fileName = `${prefix}_${imgCount}.${ext}`;
  const filePath = path.join(targetDir, fileName);
  const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');

  try {
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`  ✓ ${relativePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return relativePath;
  } catch (e) {
    console.log(`  ✗ ${fileName} - ${e.message}`);
    return null;
  }
}

// --- 1. Extract <img src="data:..."> ---
console.log('\n=== Extracting <img> base64 sources ===');
$('img[src^="data:image"]').each((i, el) => {
  const src = $(el).attr('src');
  const newPath = saveBase64(src, 'img', IMG_DIR);
  if (newPath) {
    $(el).attr('src', newPath);
  }
});

// --- 2. Extract <link> with href="data:..." (favicon etc) ---
console.log('\n=== Extracting <link> base64 hrefs ===');
$('link[href^="data:"]').each((i, el) => {
  const href = $(el).attr('href');
  const newPath = saveBase64(href, 'link', IMG_DIR);
  if (newPath) {
    $(el).attr('href', newPath);
  }
});

// --- 3. Extract inline <style> into CSS files ---
console.log('\n=== Extracting inline <style> blocks ===');
$('style').each((i, el) => {
  let css = $(el).html();
  if (!css || css.trim().length < 100) return; // skip trivial styles

  cssCount++;
  const fileName = `style_${cssCount}.css`;
  const filePath = path.join(CSS_DIR, fileName);
  const relativePath = `assets/css/${fileName}`;

  // Extract base64 inside CSS: url(data:font/...) and url(data:image/...)
  let fontInCss = 0;
  let imgInCss = 0;

  css = css.replace(/url\((["']?)data:(font\/[^;]+|application\/[^;]+);base64,([A-Za-z0-9+/=]+)\1\)/g,
    (match, quote, mime, b64) => {
      fontCount++;
      fontInCss++;
      let ext = 'woff2';
      if (mime.includes('woff2')) ext = 'woff2';
      else if (mime.includes('woff')) ext = 'woff';
      else if (mime.includes('truetype')) ext = 'ttf';
      else if (mime.includes('opentype')) ext = 'otf';
      else if (mime.includes('eot')) ext = 'eot';

      const fName = `font_${fontCount}.${ext}`;
      const fPath = path.join(FONT_DIR, fName);
      try {
        fs.writeFileSync(fPath, Buffer.from(b64, 'base64'));
        console.log(`    font: ${fName} (${(Buffer.from(b64, 'base64').length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        return match;
      }
      // Path relative from CSS file location
      return `url(../fonts/${fName})`;
    }
  );

  css = css.replace(/url\((["']?)data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)\1\)/g,
    (match, quote, imgType, b64) => {
      imgCount++;
      imgInCss++;
      let ext = imgType.replace('svg+xml', 'svg').replace('jpeg', 'jpg');
      const fName = `css_img_${imgCount}.${ext}`;
      const fPath = path.join(IMG_DIR, fName);
      try {
        fs.writeFileSync(fPath, Buffer.from(b64, 'base64'));
        console.log(`    image: ${fName} (${(Buffer.from(b64, 'base64').length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        return match;
      }
      return `url(../images/${fName})`;
    }
  );

  fs.writeFileSync(filePath, css, 'utf-8');
  const sizeKB = (Buffer.byteLength(css, 'utf-8') / 1024).toFixed(1);
  console.log(`  ✓ ${relativePath} (${sizeKB} KB, ${fontInCss} fonts, ${imgInCss} images)`);

  // Replace <style> with <link>
  $(el).replaceWith(`<link rel="stylesheet" href="${relativePath}">`);
});

// --- 4. Extract inline <script> blocks ---
console.log('\n=== Extracting inline <script> blocks ===');
$('script:not([src])').each((i, el) => {
  const js = $(el).html();
  if (!js || js.trim().length < 100) return;

  jsCount++;
  const fileName = `script_${jsCount}.js`;
  const filePath = path.join(JS_DIR, fileName);
  const relativePath = `assets/js/${fileName}`;

  fs.writeFileSync(filePath, js, 'utf-8');
  const sizeKB = (Buffer.byteLength(js, 'utf-8') / 1024).toFixed(1);
  console.log(`  ✓ ${relativePath} (${sizeKB} KB)`);

  $(el).replaceWith(`<script src="${relativePath}"></script>`);
});

// --- Write output ---
console.log('\n=== Writing output ===');
const outputHtml = $.html();
fs.writeFileSync(OUTPUT, outputHtml, 'utf-8');

const inputKB = (fs.statSync(INPUT).size / 1024).toFixed(1);
const outputKB = (Buffer.byteLength(outputHtml, 'utf-8') / 1024).toFixed(1);

console.log(`\n========== SUMMARY ==========`);
console.log(`Input:       1.html (${inputKB} KB)`);
console.log(`Output:      index.html (${outputKB} KB)`);
console.log(`Fonts:       ${fontCount} files → assets/fonts/`);
console.log(`Images:      ${imgCount} files → assets/images/`);
console.log(`CSS files:   ${cssCount} files → assets/css/`);
console.log(`JS files:    ${jsCount} files → assets/js/`);
console.log(`Reduction:   ${((1 - outputKB/inputKB) * 100).toFixed(1)}%`);
console.log(`\nDone! Open index.html to verify.`);
