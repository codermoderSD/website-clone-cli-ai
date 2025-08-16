import fs from "fs";
import path from "path";

export async function writeFileContent(input) {
    try {
        // Handle pipe-separated format: "filepath|content"
        const pipeIndex = input.indexOf('|');
        if (pipeIndex === -1) {
            return `Error: Input must be in format "filepath|content"`;
        }

        const filePath = input.substring(0, pipeIndex).trim();
        const content = input.substring(pipeIndex + 1);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });

        // Write file
        fs.writeFileSync(filePath, content, 'utf8');

        return `Successfully wrote file: ${filePath}`;
    } catch (error) {
        return `Error writing file: ${error.message}`;
    }
}
