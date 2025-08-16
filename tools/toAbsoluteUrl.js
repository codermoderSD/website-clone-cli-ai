export function toAbsoluteUrl(link, baseUrl) {
    try {
        return new URL(link, baseUrl).href;
    } catch {
        return null;
    }
}
