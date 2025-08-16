import puppeteer from "puppeteer";

export async function getHTMLContent(url) {
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
}
