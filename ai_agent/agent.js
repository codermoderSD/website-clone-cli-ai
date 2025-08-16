import { OpenAI } from "openai";
import "dotenv/config";
import ora from "ora";
import chalk from "chalk";
import path from "path";
import { getHTMLContent } from "../tools/getHTMLContent.js";
import { saveWebsiteDataInFolder } from "../tools/saveWebsiteDataInFolder.js";
import { executeCommand } from "../tools/executeCommand.js";
import { writeFileContent } from "../tools/writeFileContent.js";
import { copyImages } from "../tools/copyImages.js";
import { extractEnhancedCSS } from "../tools/extractEnhancedCSS.js";
import { copyExternalAssets } from "../tools/copyExternalAssets.js";

const TOOL_MAP = {
    getHTMLContent,
    saveWebsiteDataInFolder,
    executeCommand,
    writeFileContent,
    copyImages,
    extractEnhancedCSS,
    copyExternalAssets
};

const client = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    maxRetries: 3,
    timeout: 60000, // Increase timeout to 60 seconds
})

// Helper function to chunk HTML content
function chunkHtml(html, maxChunkSize = 50000) {
    const chunks = [];
    let currentChunk = '';

    // Simple chunking by element
    const elements = html.match(/<[^>]*>([^<]*)<\/[^>]*>|<[^>]*\/>/g) || [];

    for (const element of elements) {
        if (currentChunk.length + element.length > maxChunkSize) {
            chunks.push(currentChunk);
            currentChunk = element;
        } else {
            currentChunk += element;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

// Helper function to check if input is likely HTML
function isHtml(input) {
    return typeof input === 'string' &&
        (input.includes('<!DOCTYPE') ||
            input.includes('<html') ||
            (input.includes('<') && input.includes('>')));
}

// Helper function to extract the first valid JSON object from a string
function extractFirstJsonObject(text) {
    // Find the first opening brace
    const startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    // Keep track of braces to find the matching closing brace
    let braceCount = 0;
    let index = startIndex;

    while (index < text.length) {
        if (text[index] === '{') braceCount++;
        if (text[index] === '}') braceCount--;

        // When we find the matching closing brace, we've found our JSON object
        if (braceCount === 0 && index > startIndex) {
            return text.substring(startIndex, index + 1);
        }

        index++;
    }

    return null; // No valid JSON object found
}

export async function startAIAgent({ url }) {
    const SYSTEM_PROMPT = `
    You are an AI assistant specialized in website cloning. You work in START, THINK, TOOL, OBSERVE, and OUTPUT format.
    For a given website URL, you need to think and breakdown the cloning process into sub-problems.
    You should always keep thinking step by step before giving the actual output.
    
    Also, before outputting the final result you must check once if everything is correct.
    You have access to tools that help you clone websites effectively.
    
    For every tool call that you make, wait for the OBSERVATION from the tool which is the
    response from the tool that you called.

    IMPORTANT: After saving website data, you MUST analyze the DOM JSON structure and recreate 
    the website by writing NEW HTML, CSS, and JS files in the ./clone/{hostname}/ directory.
    Use the DOM JSON to understand the structure and recreate a functional website.
    
    The writeFileContent tool expects input in format: "filepath|content" where filepath 
    includes the full path and content is the file content to write.
    
    IMPORTANT: For saveWebsiteDataInFolder tool, you only need to provide the URL. The HTML will be 
    automatically passed from the previous getHTMLContent call - DO NOT include the HTML in your tool call.

    Available Tools:
    - getHTMLContent(url: string): Fetches fully rendered HTML content from a website using Puppeteer. Returns the complete HTML source.
    - saveWebsiteDataInFolder(url: string): Saves website data including raw HTML, extracted DOM JSON, downloads images, and extracts external CSS/JS assets. Takes only the URL parameter - the HTML content will be automatically provided from the previous getHTMLContent call. Returns folder path and DOM JSON.
    - extractEnhancedCSS(html: string): Extracts and generates comprehensive CSS from HTML, including Tailwind-like utilities for modern websites. Pass the original HTML content.
    - copyImages(sourceDir: string, targetDir: string): Copies downloaded images from website_data to clone directory. Use format "sourceDir|targetDir".
    - copyExternalAssets(sourceDir: string, targetDir: string): Copies external CSS and JS files from website_data to clone directory. Use format "sourceDir|targetDir".
    - writeFileContent(filePath: string, content: string): Writes content to a file at the specified path. Creates directories if needed.
    - executeCommand(command: string): Executes terminal/shell commands on the user's machine. Useful for file operations, git commands, etc.

    IMPORTANT NOTES:
    - For saveWebsiteDataInFolder, ONLY provide the URL parameter - do NOT include the HTML. The system automatically provides the HTML from the previous getHTMLContent call and extracts external CSS/JS.
    - For writeFileContent, use format: "filepath|content" where filepath includes the full path.
    - Always call getHTMLContent first, then saveWebsiteDataInFolder with the same URL (without HTML).
    - CRITICAL: When generating HTML files, use RELATIVE image paths (src="images/filename.jpg") NOT absolute paths (src="/images/filename.jpg") for local file viewing.

    Your Task: Clone a website by:
    1. Fetching the HTML content
    2. Saving the website data (HTML, DOM JSON, images, external CSS/JS assets)
    3. Extracting comprehensive CSS using extractEnhancedCSS tool with the original HTML
    4. Copying images from website_data to clone directory using copyImages tool
    5. Copying external CSS/JS assets using copyExternalAssets tool
    6. Analyzing the DOM JSON and recreating the website structure
    7. Writing new HTML files with proper references to copied assets and images
    8. Saving the cloned website in ./clone/{hostname} directory with proper asset links
    9. Using terminal commands to organize and finalize the clone
    10. Providing a summary of what was cloned and where it was saved

    Modern Website Note: The system now handles optimized images (Next.js /_next/image URLs, 
    redirects, CDN images) and generates relative paths for local viewing.

    Rules:
    - Strictly follow the output JSON format - NEVER use markdown code blocks or backticks
    - ALWAYS return pure JSON objects without any formatting or code blocks
    - Always follow the output in sequence: START, THINK, TOOL, OBSERVE, OUTPUT
    - Always perform only one step at a time and wait for the next step
    - ALWAYS RETURN EXACTLY ONE JSON OBJECT PER RESPONSE - NEVER MULTIPLE OBJECTS
    - Always make sure to do multiple steps of thinking before giving output
    - For every tool call always wait for the OBSERVE which contains the output from the tool
    - Think about error handling and edge cases
    - Provide helpful information about what was cloned and where files are stored

    Output JSON Format (NO MARKDOWN, PURE JSON ONLY):
    { "step": "START | THINK | TOOL | OBSERVE | OUTPUT", "content": "string", "tool_name": "string", "input": "STRING" }

    Example Flow:
    User: Clone the website at https://example.com
    ASSISTANT: { "step": "START", "content": "I need to clone the website at https://example.com. This involves fetching HTML, saving data, analyzing structure, and recreating the website." }
    ASSISTANT: {"step":"THINK","content":"First, I need to fetch the HTML content from the website using the getHTMLContent tool."}
    ASSISTANT: {"step":"TOOL","tool_name":"getHTMLContent","input":"https://example.com"}
    USER: { "step": "OBSERVE", "content": "[HTML content - 25000 bytes total. First 1000 bytes: <!DOCTYPE html><html>... Last 1000 bytes: </body></html>]" }
    ASSISTANT: { "step": "THINK", "content": "Great! I got the HTML content. Now I need to save this website data using saveWebsiteDataInFolder with the URL." }
    ASSISTANT: { "step": "TOOL", "tool_name": "saveWebsiteDataInFolder", "input": "https://example.com" }
    USER: { "step": "OBSERVE", "content": "{'folderPath': '/path/to/website_data/example.com', 'domJson': {...}}" }
    ASSISTANT: { "step": "THINK", "content": "Now I need to extract comprehensive CSS from the original HTML using extractEnhancedCSS." }
    ASSISTANT: { "step": "TOOL", "tool_name": "extractEnhancedCSS", "input": "<!DOCTYPE html><html>...full HTML content..." }
    USER: { "step": "OBSERVE", "content": "/* Generated comprehensive CSS with Tailwind utilities */..." }
    ASSISTANT: { "step": "THINK", "content": "Now I need to copy the downloaded images to the clone directory." }
    ASSISTANT: { "step": "TOOL", "tool_name": "copyImages", "input": "website_data/example.com/images|./clone/example.com/images" }
    USER: { "step": "OBSERVE", "content": "{'success': true, 'copiedCount': 5, 'images': {...}}" }
    ASSISTANT: { "step": "THINK", "content": "Perfect! Now I have the CSS and images. I need to create the HTML file with proper image paths." }
    ASSISTANT: { "step": "TOOL", "tool_name": "writeFileContent", "input": "./clone/example.com/index.html|<html>...</html>" }
    USER: { "step": "OBSERVE", "content": "Successfully wrote file: ./clone/example.com/index.html" }
    ASSISTANT: { "step": "TOOL", "tool_name": "writeFileContent", "input": "./clone/example.com/styles.css|/* comprehensive CSS */" }
    USER: { "step": "OBSERVE", "content": "Successfully wrote file: ./clone/example.com/styles.css" }
    ASSISTANT: { "step": "OUTPUT", "content": "Successfully cloned https://example.com! The website has been recreated in ./clone/example.com with HTML, comprehensive CSS, and images." }
  `;

    const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Clone the website at ${url}` },
    ];

    let html = null;
    let saveResult = null;
    let cloneResult = null;
    let stepCount = 0;
    const maxSteps = 20; // Prevent infinite loops
    let toollessIterations = 0; // Count iterations without tool calls
    const maxToollessIterations = 3; // Maximum iterations without tool calls before reminder

    console.log(chalk.blue('🚀 Starting AI Agent...'));
    console.log(chalk.gray(`Target URL: ${url}`));

    while (true) {
        stepCount++;

        // Prevent infinite loops
        if (stepCount > maxSteps) {
            console.error(chalk.red(`❌ Maximum steps (${maxSteps}) exceeded. Stopping to prevent infinite loop.`));
            throw new Error(`Agent exceeded maximum steps (${maxSteps}). Process terminated.`);
        }

        console.log(chalk.magenta(`\n🔄 Step ${stepCount}/${maxSteps}...`));

        // Simplified API call without complex retry logic
        const response = await client.chat.completions.create({
            model: "gemini-2.5-flash",
            messages,
            response_format: { type: "json_object" }, // Force JSON response format
        });

        // Simplified response extraction
        let rawContent;

        // Check for standard OpenAI format first
        if (response.choices && response.choices.length > 0 && response.choices[0].message) {
            rawContent = response.choices[0].message.content;
        }
        // Check for Gemini format
        else if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
            rawContent = response.candidates[0].content.parts?.[0]?.text;
        }

        // Skip this iteration if no content
        if (!rawContent || rawContent.trim() === '') {
            console.log(chalk.yellow(`⚠️ Empty response received, retrying...`));
            continue;
        }

        // Clean up markdown formatting
        if (rawContent.includes('```json')) {
            rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }
        if (rawContent.includes('```')) {
            rawContent = rawContent.replace(/```/g, '');
        }

        // Parse JSON
        let parsedContent;
        try {
            parsedContent = JSON.parse(rawContent);
        } catch (error) {
            console.error(chalk.red(`❌ JSON Parse Error: ${error.message}`));
            console.error(chalk.gray(`Raw content: ${rawContent}`));
            continue; // Skip this iteration and retry
        }

        // Add to conversation
        messages.push({ role: "assistant", content: JSON.stringify(parsedContent) });

        if (parsedContent.step === "START") {
            console.log(chalk.blue('🔥'), parsedContent.content);
            continue;
        }

        if (parsedContent.step === "THINK") {
            console.log(chalk.gray('\t🧠'), parsedContent.content);

            // Increment counter for iterations without tool calls
            toollessIterations++;

            // If we've had too many iterations without tool calls, remind the model
            if (toollessIterations >= maxToollessIterations) {
                console.log(chalk.yellow(`⚠️ ${maxToollessIterations} iterations without tool calls - adding reminder`));
                messages.push({
                    role: 'user',
                    content: JSON.stringify({
                        step: 'OBSERVE',
                        content: "Remember to use tools like getHTMLContent, saveWebsiteDataInFolder, or writeFileContent to make progress. Please call a tool now instead of just thinking."
                    })
                });
                toollessIterations = 0; // Reset counter after reminder
            }

            continue;
        }

        if (parsedContent.step === "TOOL") {
            const toolToCall = parsedContent.tool_name;

            // Reset toolless iterations counter since we have a tool call
            toollessIterations = 0;

            if (!TOOL_MAP[toolToCall]) {
                console.error(chalk.red(`❌ Unknown tool: ${toolToCall}`));
                messages.push({
                    role: 'user',
                    content: JSON.stringify({
                        step: 'OBSERVE',
                        content: `There is no such tool as ${toolToCall}. Available tools are: ${Object.keys(TOOL_MAP).join(', ')}`
                    }),
                });
                continue;
            }

            let responseFromTool;
            try {
                // For extractEnhancedCSS, use the stored HTML instead of passing it as parameter
                if (toolToCall === 'extractEnhancedCSS') {
                    if (html) {
                        console.log(chalk.yellow(`📦 Using original HTML for CSS extraction (${html.length} bytes)`));
                        responseFromTool = await TOOL_MAP[toolToCall](html);
                    } else {
                        console.error(chalk.red(`❌ extractEnhancedCSS called but no HTML content available`));
                        responseFromTool = "Error: No HTML content available. Please call getHTMLContent first.";
                    }
                }
                // Always use the original HTML with saveWebsiteDataInFolder, regardless of model input
                else if (toolToCall === 'saveWebsiteDataInFolder') {
                    if (html) {
                        // Extract just the URL from the input, ignore any HTML provided by the model
                        let extractedUrl;
                        if (parsedContent.input.includes(',')) {
                            extractedUrl = parsedContent.input.split(',')[0].trim();
                        } else {
                            // If model didn't use comma format, try to extract a URL from the input
                            const urlMatch = parsedContent.input.match(/(https?:\/\/[^\s]+)/);
                            extractedUrl = urlMatch ? urlMatch[0] : url; // Fall back to original URL if nothing found
                        }

                        console.log(chalk.yellow(`📦 Using original HTML for saving (${html.length} bytes)`));
                        responseFromTool = await TOOL_MAP[toolToCall](extractedUrl, html);

                        // Save the result for return value
                        saveResult = responseFromTool;
                    } else {
                        console.error(chalk.red(`❌ saveWebsiteDataInFolder called but no HTML content available`));
                        responseFromTool = "Error: No HTML content available. Please call getHTMLContent first.";
                    }
                } else {
                    // For other tools, execute normally
                    responseFromTool = await TOOL_MAP[toolToCall](parsedContent.input);
                }

                // Handle HTML content chunking for getHTMLContent
                if (toolToCall === 'getHTMLContent' && isHtml(responseFromTool)) {
                    console.log(chalk.yellow(`📦 Large HTML detected (${responseFromTool.length} chars), storing and creating summary...`));

                    // Save the full HTML for later reference
                    html = responseFromTool;

                    // Create a summarized version for the model
                    const firstBytes = responseFromTool.substring(0, 1000);
                    const lastBytes = responseFromTool.substring(responseFromTool.length - 1000);
                    const summary = `[HTML content - ${responseFromTool.length} bytes total. First 1000 bytes: ${firstBytes}... Last 1000 bytes: ${lastBytes}]`;

                    console.log(chalk.green(`� Created HTML summary for model consumption`));
                    responseFromTool = summary;
                }

            } catch (toolError) {
                console.error(chalk.red(`❌ Tool execution failed: ${toolError.message}`));
                responseFromTool = `Error: ${toolError.message}`;
            }

            console.log(`🛠️: ${toolToCall}(${parsedContent.input}) = `,
                typeof responseFromTool === 'string' && responseFromTool.length > 100
                    ? responseFromTool.substring(0, 100) + "..."
                    : responseFromTool
            );

            messages.push({
                role: 'user',
                content: JSON.stringify({ step: 'OBSERVE', content: responseFromTool }),
            });
            continue;
        }

        if (parsedContent.step === "OUTPUT") {
            console.log(chalk.green('🤖'), parsedContent.content);
            break;
        }

        console.log(chalk.yellow(`⚠️ Unknown step: ${parsedContent.step}`));
    }

    console.log('Done...');
    return { saveResult, cloneResult };
}
