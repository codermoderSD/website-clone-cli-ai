import { exec } from "child_process";
export async function executeCommand(cmd = "") {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) return resolve(`Error: ${stderr || error.message}`);
            resolve(stdout);
        });
    });
}