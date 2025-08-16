import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export async function downloadAsset(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/css,*/*;q=0.1',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
            }
        };

        const file = fs.createWriteStream(dest);

        const request = protocol.get(url, options, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Redirecting asset to: ${response.headers.location}`);
                return downloadAsset(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            response.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log(`Successfully downloaded asset: ${path.basename(dest)}`);
                resolve();
            });
        });

        request.on("error", (err) => {
            file.close();
            fs.unlink(dest, () => reject(err));
        });

        request.setTimeout(15000, () => {
            request.abort();
            reject(new Error('Asset download timeout'));
        });
    });
}

export async function extractExternalAssets(url, html, outputDir) {
    const { load } = await import('cheerio');
    const $ = load(html);
    const hostname = new URL(url).hostname;
    const assetsDir = path.join(outputDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    console.log('📦 Extracting external CSS and JS assets...');

    const assets = {
        css: [],
        js: []
    };

    // Extract CSS files
    $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('data:')) {
            let absoluteUrl = href;
            if (href.startsWith('/')) {
                absoluteUrl = `${new URL(url).protocol}//${hostname}${href}`;
            } else if (!href.startsWith('http')) {
                absoluteUrl = new URL(href, url).href;
            }
            assets.css.push(absoluteUrl);
        }
    });

    // Extract important JS files (skip analytics, ads, etc.)
    $('script[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('data:') &&
            !src.includes('google') &&
            !src.includes('analytics') &&
            !src.includes('facebook') &&
            !src.includes('twitter')) {
            let absoluteUrl = src;
            if (src.startsWith('/')) {
                absoluteUrl = `${new URL(url).protocol}//${hostname}${src}`;
            } else if (!src.startsWith('http')) {
                absoluteUrl = new URL(src, url).href;
            }
            assets.js.push(absoluteUrl);
        }
    });

    console.log(`Found ${assets.css.length} CSS files and ${assets.js.length} JS files`);

    // Download CSS files
    for (let i = 0; i < assets.css.length; i++) {
        const cssUrl = assets.css[i];
        const filename = `styles_${i + 1}.css`;
        const filepath = path.join(assetsDir, filename);

        try {
            console.log(`Downloading CSS: ${cssUrl}`);
            await downloadAsset(cssUrl, filepath);
        } catch (error) {
            console.error(`Failed to download CSS ${cssUrl}:`, error.message);
        }
    }

    // Download critical JS files (limit to avoid bloat)
    const criticalJS = assets.js.slice(0, 5); // Only first 5 JS files
    for (let i = 0; i < criticalJS.length; i++) {
        const jsUrl = criticalJS[i];
        const filename = `script_${i + 1}.js`;
        const filepath = path.join(assetsDir, filename);

        try {
            console.log(`Downloading JS: ${jsUrl}`);
            await downloadAsset(jsUrl, filepath);
        } catch (error) {
            console.error(`Failed to download JS ${jsUrl}:`, error.message);
        }
    }

    return {
        assetsDir,
        cssFiles: assets.css.length,
        jsFiles: criticalJS.length
    };
}
