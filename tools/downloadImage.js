import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { URL } from "url";

export async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        // Handle Next.js optimized images by extracting the original URL
        let actualUrl = url;

        try {
            const urlObj = new URL(url);

            // Check if it's a Next.js optimized image URL
            if (urlObj.pathname.includes('/_next/image')) {
                const originalUrl = urlObj.searchParams.get('url');
                if (originalUrl) {
                    // Decode the URL parameter
                    const decodedUrl = decodeURIComponent(originalUrl);
                    // Make it absolute if it's relative
                    if (decodedUrl.startsWith('/')) {
                        actualUrl = `${urlObj.protocol}//${urlObj.host}${decodedUrl}`;
                    } else {
                        actualUrl = decodedUrl;
                    }
                }
            }
        } catch (e) {
            console.log(`Error parsing URL ${url}, using as-is: ${e.message}`);
        }

        console.log(`Downloading image: ${actualUrl}`);

        const file = fs.createWriteStream(dest);
        const protocol = actualUrl.startsWith('https:') ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        };

        const request = protocol.get(actualUrl, options, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Redirecting to: ${response.headers.location}`);
                return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            response.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log(`Successfully downloaded: ${path.basename(dest)}`);
                resolve();
            });
        });

        request.on("error", (err) => {
            file.close();
            fs.unlink(dest, () => reject(err));
        });

        // Set timeout
        request.setTimeout(10000, () => {
            request.abort();
            reject(new Error('Download timeout'));
        });
    });
}
