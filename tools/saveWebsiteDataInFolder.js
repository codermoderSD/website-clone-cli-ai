import fs from "fs";
import path from "path";
import { load } from "cheerio";
import { extractDomJson } from "./extractDomJson.js";
import { toAbsoluteUrl } from "./toAbsoluteUrl.js";
import { downloadImage } from "./downloadImage.js";
import { extractExternalAssets } from "./extractExternalAssets.js";

export async function saveWebsiteDataInFolder(url, html) {
    const hostname = new URL(url).hostname;
    const folderPath = path.join(process.cwd(), "website_data", hostname);
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, "raw.html"), html);
    const domJson = extractDomJson(html);
    fs.writeFileSync(path.join(folderPath, "dom.json"), JSON.stringify(domJson, null, 2));
    const $ = load(html);
    const imgDir = path.join(folderPath, "images");
    fs.mkdirSync(imgDir, { recursive: true });
    const imgElements = $("img").toArray();

    console.log(`Found ${imgElements.length} image elements to process`);

    for (const el of imgElements) {
        let src = $(el).attr("src");

        // Try srcset if src is not available or is a placeholder
        if (!src || src.includes('data:') || src.includes('placeholder')) {
            const srcset = $(el).attr("srcset");
            if (srcset) {
                // Extract the highest quality image from srcset
                const srcsetEntries = srcset.split(',').map(entry => entry.trim());
                const lastEntry = srcsetEntries[srcsetEntries.length - 1];
                src = lastEntry.split(' ')[0];
                console.log(`Using srcset URL: ${src}`);
            }
        }

        if (!src) {
            console.log('Skipping image element with no src or srcset');
            continue;
        }

        if (src.startsWith("data:")) {
            const matches = src.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                const ext = matches[1].split("/")[1];
                const base64Data = matches[2];
                const imgPath = path.join(imgDir, `inline_${Math.random().toString(36).slice(2)}.${ext}`);
                fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
                console.log(`Saved inline image: ${path.basename(imgPath)}`);
            }
            continue;
        }
        const absUrl = toAbsoluteUrl(src, url);
        if (!absUrl) continue;

        // Generate a safe filename for images with long URLs
        let filename = path.basename(src);

        // If filename is too long or contains query parameters, generate a shorter one
        if (filename.length > 100 || filename.includes('?') || filename.includes('&')) {
            // Extract extension from URL or default to .jpg
            let ext = '.jpg';
            const urlPath = new URL(absUrl).pathname;
            const pathExt = path.extname(urlPath);
            if (pathExt && pathExt.length <= 5) {
                ext = pathExt;
            }

            // Generate a hash-based filename
            const hash = Math.random().toString(36).slice(2, 10);
            filename = `img_${hash}${ext}`;
        }

        const imgPath = path.join(imgDir, filename);
        try {
            await downloadImage(absUrl, imgPath);
        } catch (e) {
            console.error(`Failed to download ${absUrl}:`, e.message);
        }
    }

    // Extract external CSS and JS assets
    try {
        console.log('📦 Extracting external CSS and JS assets...');
        const assetInfo = await extractExternalAssets(url, html, folderPath);
        console.log(`✅ Downloaded ${assetInfo.cssFiles} CSS files and ${assetInfo.jsFiles} JS files to ${assetInfo.assetsDir}`);
    } catch (error) {
        console.error('❌ Failed to extract external assets:', error.message);
    }

    return { folderPath, domJson };
}
