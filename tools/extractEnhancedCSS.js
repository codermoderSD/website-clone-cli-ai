import * as cheerio from 'cheerio';

export async function extractEnhancedCSS(htmlContent) {
    try {
        console.log('📦 Starting CSS extraction...');
        const $ = cheerio.load(htmlContent, {
            xml: false,
            decodeEntities: false // Faster parsing
        });

        let extractedCSS = '';

        // Extract inline styles and link CSS with progress tracking
        const styleElements = $('style');
        console.log(`📦 Found ${styleElements.length} style elements`);

        styleElements.each((_, el) => {
            const styleContent = $(el).html();
            if (styleContent && styleContent.trim()) {
                extractedCSS += styleContent + '\n';
            }
        });

        // Extract link[rel="stylesheet"] hrefs (for reference)
        const stylesheetLinks = [];
        $('link[rel="stylesheet"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                stylesheetLinks.push(href);
            }
        });

        console.log(`📦 Found ${stylesheetLinks.length} external stylesheets`);

        // Generate comprehensive utility classes (optimized)
        console.log('📦 Generating utility CSS...');
        const utilityCSS = generateOptimizedUtilityCSS($);

        const enhancedCSS = `/* Extracted Styles */
${extractedCSS}

/* Utility Classes (Tailwind-like) */
${utilityCSS}

/* External Stylesheets Referenced */
${stylesheetLinks.map(link => `/* ${link} */`).join('\n')}`;

        console.log(`📦 CSS extraction complete: ${enhancedCSS.length} bytes`);
        return enhancedCSS.trim();
    } catch (error) {
        console.error('Error extracting enhanced CSS:', error);
        return `/* Error extracting CSS: ${error.message} */`;
    }
}

function generateOptimizedUtilityCSS($) {
    // Collect unique classes used in the HTML for more targeted utility generation
    const classesUsed = new Set();

    // Scan for class attributes (limited scan for performance)
    $('[class]').slice(0, 500).each((_, el) => { // Limit to first 500 elements for performance
        const classAttr = $(el).attr('class');
        if (classAttr) {
            classAttr.split(/\s+/).forEach(cls => {
                if (cls.trim()) classesUsed.add(cls.trim());
            });
        }
    });

    console.log(`📦 Found ${classesUsed.size} unique classes in HTML`);

    // Generate utility CSS based on common patterns and classes found
    let utilities = `
/* Reset and base styles */
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
img { max-width: 100%; height: auto; display: block; }

/* Common utilities */
.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.flex { display: flex; }
.block { display: block; }
.inline-block { display: inline-block; }
.hidden { display: none; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.font-bold { font-weight: bold; }
.font-normal { font-weight: normal; }

/* Spacing utilities */
.m-0 { margin: 0; }
.p-0 { padding: 0; }
.mt-4 { margin-top: 1rem; }
.mb-4 { margin-bottom: 1rem; }
.pt-4 { padding-top: 1rem; }
.pb-4 { padding-bottom: 1rem; }

/* Color utilities */
.text-white { color: white; }
.text-black { color: black; }
.bg-white { background-color: white; }
.bg-black { background-color: black; }

/* Responsive utilities */
@media (max-width: 768px) {
  .container { padding: 0 0.5rem; }
}
`;

    return utilities;
}
