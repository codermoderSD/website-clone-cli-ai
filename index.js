#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { startAIAgent } from "./ai_agent/agent.js";

program
    .version("1.0.0")
    .description("Website Clone CLI")

program.action(() => {
    inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'Enter website URL you want to clone:'
        }
    ]).then(async (answer) => {
        const url = answer.url.trim();
        if (!url.startsWith("http")) {
            console.log(chalk.red("Please enter a valid URL (must start with http/https)."));
            process.exit(1);
        }

        console.log(chalk.blue(`\n🚀 Starting AI-powered website cloning for: ${url}\n`));

        try {
            const result = await startAIAgent({ url });

            if (result) {
                console.log(chalk.green(`\n✅ Website cloning completed successfully!`));
                if (result.saveResult) {
                    console.log(chalk.gray(`📁 Raw data saved to: ${result.saveResult.folderPath}`));
                }
                if (result.cloneResult) {
                    console.log(chalk.green(`🌐 Website cloned to: ${result.cloneResult.clonePath}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Clone directory not yet created - check AI agent output above`));
                }
            }
        } catch (error) {
            console.error(chalk.red(`\n❌ Error during cloning: ${error.message}`));
        }
    }).catch((error) => {
        console.error(chalk.red(`\n❌ Error during cloning: ${error.message}`));
    });
})

program.parse(process.argv);