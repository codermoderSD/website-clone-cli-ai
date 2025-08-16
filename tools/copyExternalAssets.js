import fs from 'fs';
import path from 'path';

export async function copyExternalAssets(sourceDir, targetDir) {
    const assetsSourceDir = path.join(sourceDir, 'assets');
    const assetsTargetDir = path.join(targetDir, 'assets');

    if (!fs.existsSync(assetsSourceDir)) {
        console.log('No external assets found to copy');
        return { success: false, message: 'No assets directory found' };
    }

    // Create target assets directory
    fs.mkdirSync(assetsTargetDir, { recursive: true });

    // Copy all files from source to target
    const files = fs.readdirSync(assetsSourceDir);
    console.log(`📦 Copying ${files.length} external assets...`);

    const copiedAssets = {
        css: [],
        js: []
    };

    for (const file of files) {
        const sourcePath = path.join(assetsSourceDir, file);
        const targetPath = path.join(assetsTargetDir, file);

        try {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`✅ Copied: ${file}`);

            if (file.endsWith('.css')) {
                copiedAssets.css.push(file);
            } else if (file.endsWith('.js')) {
                copiedAssets.js.push(file);
            }
        } catch (error) {
            console.error(`❌ Failed to copy ${file}:`, error.message);
        }
    }

    return {
        success: true,
        copiedAssets,
        assetsDir: assetsTargetDir
    };
}
