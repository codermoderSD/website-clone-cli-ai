import { load } from "cheerio";

export function extractDomJson(html) {
    const $ = load(html);
    $("script, iframe, noscript, style, link[rel='preload'], link[rel='prefetch']").remove();

    function parseElement(el) {
        const node = $(el);
        const tag = node[0].tagName;
        const attribs = node[0].attribs || {};
        const obj = {
            type: tag,
            attributes: Object.fromEntries(
                Object.entries(attribs).filter(([key]) =>
                    ["class", "id", "src", "href", "alt"].includes(key)
                )
            ),
            children: []
        };
        const text = node.text().trim();
        if (text && text.length < 100) obj.text = text;
        node.children().each((_, child) => {
            if (child.type === "tag") obj.children.push(parseElement(child));
        });
        return obj;
    }
    return $("body").children().toArray()
        .filter(el => el.type === "tag")
        .map(parseElement);
}
