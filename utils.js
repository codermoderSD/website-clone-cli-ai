import { load } from "cheerio";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

/**
 * Fetch fully rendered HTML using Puppeteer.
 */
export async function getHTMLContent(url) {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        );
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        const html = await page.content();
        await browser.close();
        return html;
    } catch (error) {
        console.error("❌ Failed to fetch page with Puppeteer:", error.message);
        return null;
    }
}

/**
 * Convert relative URLs to absolute.
 */
function toAbsoluteUrl(link, baseUrl) {
    try {
        return new URL(link, baseUrl).href;
    } catch {
        return null;
    }
}

/**
 * Download a file via fetch.
 */
async function downloadFile(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
}

/**
 * Save HTML, DOM JSON, and assets (images).
 */
export async function saveWebsiteDataInFolder(url, html) {
    const hostname = new URL(url).hostname;
    const folderPath = path.join(process.cwd(), "website_data", hostname);
    fs.mkdirSync(folderPath, { recursive: true });

    // Save raw HTML
    fs.writeFileSync(path.join(folderPath, "raw.html"), html);

    // Extract and save DOM JSON
    const domJson = extractDomJson(html, url);
    fs.writeFileSync(path.join(folderPath, "dom.json"), JSON.stringify(domJson, null, 2));

    // Download images in parallel
    const $ = load(html);
    const imgDir = path.join(folderPath, "images");
    fs.mkdirSync(imgDir, { recursive: true });

    const downloadTasks = [];
    let imgCount = 0;

    $("img[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;

        if (src.startsWith("data:")) {
            // Save inline base64 image
            const matches = src.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                const ext = matches[1].split("/")[1];
                const base64Data = matches[2];
                const imgPath = path.join(imgDir, `inline_${imgCount++}.${ext}`);
                fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
            }
        } else {
            const absUrl = toAbsoluteUrl(src, url);
            if (absUrl) {
                const fileName = `${imgCount++}_${path.basename(src)}`;
                const dest = path.join(imgDir, fileName);
                downloadTasks.push(downloadFile(absUrl, dest).catch(() => { }));
            }
        }
    });

    await Promise.all(downloadTasks);
    console.log(`✅ Saved ${imgCount} images.`);

    return { folderPath, domJson };
}

/**
 * Extract simplified DOM structure for LLM.
 */
export function extractDomJson(html, baseUrl) {
    const $ = load(html);
    $("script, iframe, noscript, style, link[rel='preload'], link[rel='prefetch']").remove();

    function parseElement(el) {
        const node = $(el);
        const tag = node[0].tagName;
        const attribs = node[0].attribs || {};

        const obj = {
            type: tag,
            attributes: {}
        };

        // Pick relevant attributes
        for (const [key, value] of Object.entries(attribs)) {
            if (
                ["id", "class", "src", "href", "alt", "role"].includes(key) ||
                key.startsWith("aria-") ||
                key.startsWith("data-")
            ) {
                obj.attributes[key] = (key === "src" || key === "href") ? toAbsoluteUrl(value, baseUrl) : value;
            }
        }

        // Include text if it's short and meaningful
        const text = node.clone().children().remove().end().text().trim();
        if (text && text.length < 120) obj.text = text;

        // Parse children recursively
        const children = [];
        node.children().each((_, child) => {
            if (child.type === "tag") {
                children.push(parseElement(child));
            }
        });
        if (children.length) obj.children = children;

        return obj;
    }

    return $("body").children().toArray()
        .filter(el => el.type === "tag")
        .map(parseElement);
}
