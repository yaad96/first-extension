import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LearnDesignRules {
    private static filePrefix: { [key: string]: string } = {
        "FPMax": "AttributeEncoding",
        "FPClose": "AttributeEncoding",
        "CHUI-Miner": "Weighted_AttributeEncoding",
        "CHUI-MinerMax": "Weighted_AttributeEncoding",
    };
    private static timeoutInSeconds = 5;

    public static async analyzeDatabases(projectPath: string, params: Array<string>, directory: string, algorithm: string): Promise<any> {
        const fullPath = path.join(projectPath, directory);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath);
        }

        const fileList: string[] = [];
        const outputFileList: string[] = [];
        const files = fs.readdirSync(fullPath);

        files.forEach(file => {
            if (file.startsWith(this.filePrefix[algorithm])) {
                fileList.push(file);
            } else if (file.startsWith("output_")) {
                outputFileList.push(file);
            }
        });

        // Delete output files
        outputFileList.forEach(file => {
            fs.unlinkSync(path.join(fullPath, file));
        });

        for (const file of fileList) {
            const inputFile = path.join(fullPath, file);
            const outputFile = path.join(fullPath, `output_${file}`);
            const command = `java -jar ${path.join(projectPath, "/spmf.jar")} run ${algorithm} ${inputFile} ${outputFile} ${params.join(" ")}`;

            try {
                await execAsync(command, { timeout: this.timeoutInSeconds * 1000 });
            } catch (error) {
                console.error(`Error executing command: ${command}`, error);
            }
        }

        const results: { [key: string]: string } = {};
        for (const file of fileList) {
            const outputFile = path.join(fullPath, `output_${file}`);
            try {
                const data = fs.readFileSync(outputFile, { encoding: 'utf8' });
                results[file] = data;
            } catch (error) {
                console.error(`Error reading output file: ${outputFile}`, error);
            }
        }

        return results;
    }
}

