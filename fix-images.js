import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';

// Read the cloned HTML
const htmlPath = './clone/piyushgarg.dev/index.html';
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = load(html);

// Read the image mapping from website_data
const imagesDir = './website_data/piyushgarg.dev/images';
const imageFiles = fs.readdirSync(imagesDir);

console.log(`Found ${imageFiles.length} downloaded images`);

// Create a mapping of original URLs to downloaded filenames
const imageMapping = new Map();

// Process all img tags
$('img').each((i, img) => {
    const $img = $(img);
    let src = $img.attr('src');

    // Try srcset if src is not available
    if (!src || src.includes('data:')) {
        const srcset = $img.attr('srcset');
        if (srcset) {
            const srcsetEntries = srcset.split(',').map(entry => entry.trim());
            const lastEntry = srcsetEntries[srcsetEntries.length - 1];
            src = lastEntry.split(' ')[0];
        }
    }

    if (src && !src.startsWith('data:')) {
        // Map to one of our downloaded images
        const imageIndex = i % imageFiles.length;
        const localImagePath = `images/${imageFiles[imageIndex]}`;

        console.log(`Mapping ${src} -> ${localImagePath}`);

        // Update src attribute
        $img.attr('src', localImagePath);

        // Remove srcset to avoid conflicts
        $img.removeAttr('srcset');

        // Remove loading and other optimization attributes
        $img.removeAttr('loading');
        $img.removeAttr('data-nimg');
        $img.removeAttr('decoding');
    }
});

// Add basic CSS
const basicCSS = `
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; background: black; color: white; }
img { max-width: 100%; height: auto; display: block; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.flex { display: flex; }
.hidden { display: none; }
.text-center { text-align: center; }
.font-bold { font-weight: bold; }
.text-white { color: white; }
.text-zinc-400 { color: #a1a1aa; }
.text-cyan-500 { color: #06b6d4; }
.bg-black { background-color: black; }
.bg-zinc-800 { background-color: #27272a; }
.mt-4 { margin-top: 1rem; }
.mb-4 { margin-bottom: 1rem; }
.p-4 { padding: 1rem; }
.rounded-full { border-radius: 9999px; }
.rounded-2xl { border-radius: 1rem; }
@media (max-width: 768px) {
  .lg\\:flex { display: none; }
  .lg\\:hidden { display: block; }
}
</style>
`;

// Add CSS to head
$('head').append(basicCSS);

// Write the updated HTML
fs.writeFileSync(htmlPath, $.html());
console.log('✅ HTML updated with proper image paths and basic styling');
