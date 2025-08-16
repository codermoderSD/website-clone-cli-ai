import fs from "fs";
import path from "path";

export async function copyImages(input) {
    try {
        // Handle pipe-separated format: "sourceDir|targetDir"
        const pipeIndex = input.indexOf('|');
        if (pipeIndex === -1) {
            return {
                success: false,
                error: 'Input must be in format "sourceDir|targetDir"'
            };
        }

        const sourceDir = input.substring(0, pipeIndex).trim();
        const targetDir = input.substring(pipeIndex + 1).trim();
        // Create target images directory
        fs.mkdirSync(targetDir, { recursive: true });

        // Copy images and maintain mapping
        const copiedImages = {};

        if (fs.existsSync(sourceDir)) {
            const files = fs.readdirSync(sourceDir);

            for (const file of files) {
                const sourcePath = path.join(sourceDir, file);
                const targetPath = path.join(targetDir, file);

                // Copy the image file
                fs.copyFileSync(sourcePath, targetPath);

                // Store the mapping for reference
                copiedImages[file] = path.relative(path.dirname(targetDir), targetPath);
            }
        }

        return {
            success: true,
            copiedCount: Object.keys(copiedImages).length,
            images: copiedImages
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
