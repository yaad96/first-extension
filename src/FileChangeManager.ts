import * as vscode from 'vscode';
import WebSocket from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { WebSocketConstants } from './WebSocketConstants';
import { generateProjectHierarchyAsJSON } from './utilites';
import { MessageProcessor } from './MessageProcessor';
import { FollowAndAuthorRulesProcessor } from './FollowAndAuthorRulesProcessor';
import { MiningRulesProcessor } from './MiningRulesProcessor';

const readFileAsync = promisify(fs.readFile);

export class FileChangeManager {
    private static instance: FileChangeManager;
    private ws: WebSocket | null = null;
    private xmlFiles: { filePath: string; xmlContent: string }[] = [];
    private projectPath:string;

    private constructor(projectPath:string,ws:WebSocket) {
        this.projectPath = projectPath;
        this.ws = ws;
        this.watchWorkspaceChanges();
        if (vscode.workspace.workspaceFolders) {
            //const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            this.convertAllJavaFilesToXML(this.projectPath).then(() => {
                console.log('All Java files have been converted to XML and stored.');
                // Here you can optionally handle the stored XML data, e.g., send via WebSocket
            }).catch(error => console.error('Error converting Java files to XML:', error));

            try {
                const ins = FollowAndAuthorRulesProcessor.getInstance();
                if (!ins) {
                    // If getInstance() returned null, we create a new instance
                    // But since our getInstance never returns null (creates a new instance if null),
                    // This check is just for demonstrating a similar approach to catching NullPointerException in Java.
                    throw new Error('Instance is null'); // Simulating a scenario to create a new instance
                }
                ins.updateProjectWs(this.projectPath, this.ws);
            } catch (error) {
                if (error instanceof Error && error.message === 'Instance is null') {
                    // This block is for handling the specific error thrown above,
                    // simulating the catch for NullPointerException in Java.
                    // In practical TypeScript, this pattern is rarely needed due to the dynamic nature of JS and the way we handle nulls/undefined values.
                    new FollowAndAuthorRulesProcessor(projectPath, this.ws); // Assuming this will set the instance internally or perform necessary actions
                } else {
                    console.error("An unexpected error occurred:", error);
                    // Handle or log the error appropriately
                }
            }

            try {
                const ins = MiningRulesProcessor.getInstance();
                if (!ins) {
                    // If getInstance() returned null, we create a new instance
                    // But since our getInstance never returns null (creates a new instance if null),
                    // This check is just for demonstrating a similar approach to catching NullPointerException in Java.
                    throw new Error('Instance is null'); // Simulating a scenario to create a new instance
                }
                ins.updateProjectWs(this.projectPath, this.ws);
            } catch (error) {
                if (error instanceof Error && error.message === 'Instance is null') {
                    // This block is for handling the specific error thrown above,
                    // simulating the catch for NullPointerException in Java.
                    // In practical TypeScript, this pattern is rarely needed due to the dynamic nature of JS and the way we handle nulls/undefined values.
                    new MiningRulesProcessor(projectPath, this.ws); // Assuming this will set the instance internally or perform necessary actions
                } else {
                    console.error("An unexpected error occurred:", error);
                    // Handle or log the error appropriately
                }
            }
            

        }
    }

    public static getInstance(projectPath:string,ws:WebSocket): FileChangeManager {
        if (!FileChangeManager.instance) {
            FileChangeManager.instance = new FileChangeManager(projectPath,ws);
        }
        return FileChangeManager.instance;
    }

    public setWebSocket(ws: WebSocket) {
        this.ws = ws;
    }

    private watchWorkspaceChanges() {
        vscode.workspace.onDidChangeTextDocument(this.handleChangeTextDocument.bind(this));
        vscode.workspace.onDidCreateFiles(this.handleCreateFile.bind(this));
        vscode.workspace.onDidDeleteFiles(this.handleDeleteFile.bind(this));
        vscode.workspace.onDidRenameFiles(this.handleRenameFile.bind(this));
        // You can add more event listeners as needed
    }

    private sendUpdatedXMLFile(javaFilePath:string,xmlContent:String,command:string){
        if (this.ws) {
            const message = JSON.stringify({
                command: command,
                data: { filePath: javaFilePath, xml: xmlContent }
            });
            this.ws.send(message, error => {
                if (error) {
                    console.error(`Error sending XML for file ${javaFilePath}:`, error);
                }
                else { console.log(`Successfully sent XML for file ${javaFilePath}`); }
            });

            const check_rule_messaage = JSON.stringify({
                command:WebSocketConstants.SEND_CHECK_RULES_FOR_FILE_MSG,
                data:javaFilePath

            });
            this.ws.send(check_rule_messaage, error => {
                if (error) {
                    console.error(`Error sending check_rule_message for file ${javaFilePath}:`, error);
                }
                else { console.log(`Successfully sent check_rule_message for file ${javaFilePath}`); }
            });

            // sendMessage(MessageProcessor.encodeData(new Object[]{WebSocketConstants.SEND_CHECK_RULES_FOR_FILE_MSG,
            //filePath}).toString());  etao korte hobe
        }
    }

    private async updateProjectHierarchy() {
        try {
            const projectHierarchy = await generateProjectHierarchyAsJSON();
            if (this.ws) {
                this.ws.send(MessageProcessor.encodeData({
                    command: WebSocketConstants.SEND_PROJECT_HIERARCHY_MSG,
                    data: JSON.stringify(projectHierarchy),
                }));
            }
        } catch (error) {
            console.error('Failed to generate project hierarchy:', error);
        }
    }
    

    private async handleCreateFile(event: vscode.FileCreateEvent) {
        for (const file of event.files) {
            if (file.path.endsWith('.java')) {
                const javaFilePath = file.fsPath;
    
                try {
                    const xmlContent = await this.convertToXML(javaFilePath); // Adjusted call
                    this.xmlFiles.push({ filePath: javaFilePath, xmlContent });
    
                    this.sendUpdatedXMLFile(javaFilePath, xmlContent, WebSocketConstants.SEND_UPDATE_XML_FILE_MSG);
                    
                    // Generate and send new project hierarchy
                    this.updateProjectHierarchy();
                } catch (error) {
                    console.error(`Error processing newly created file ${javaFilePath}:`, error);
                }
            }
        }
    }
    


    private async handleDeleteFile(event: vscode.FileDeleteEvent) {
        for (const file of event.files) {
            if (file.path.endsWith('.java')) {
                const javaFilePath = file.fsPath;
                const index = this.xmlFiles.findIndex(x => x.filePath === javaFilePath);
                if (index !== -1) {
                    this.xmlFiles.splice(index, 1);
    
                    this.sendUpdatedXMLFile(javaFilePath, "", WebSocketConstants.SEND_UPDATE_XML_FILE_MSG);
    
                    // Generate and send new project hierarchy
                    this.updateProjectHierarchy();
                }
            }
        }
    }
    
    


    private async handleRenameFile(event: vscode.FileRenameEvent) {
        for (const { oldUri, newUri } of event.files) {
            if (newUri.path.endsWith('.java')) {
                const newFilePath = newUri.fsPath;
                const oldIndex = this.xmlFiles.findIndex(x => x.filePath === oldUri.fsPath);
    
                try {
                    const xmlContent = await this.convertToXML(newFilePath);
    
                    if (oldIndex !== -1) {
                        this.xmlFiles.splice(oldIndex, 1); // Remove old entry
                    }
                    this.xmlFiles.push({ filePath: newFilePath, xmlContent });
    
                    this.sendUpdatedXMLFile(newFilePath, xmlContent, WebSocketConstants.SEND_UPDATE_XML_FILE_MSG);
    
                    // Generate and send new project hierarchy
                    this.updateProjectHierarchy();
                } catch (error) {
                    console.error(`Error processing renamed file ${newFilePath}:`, error);
                }
            }
        }
    }
    




    private async handleChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
        if (this.ws && event.document.languageId === 'java') {
            const javaFilePath = event.document.uri.fsPath;
    
            try {
                const xmlContent = await this.convertToXML(javaFilePath);
    
                const existingFileIndex = this.xmlFiles.findIndex(file => file.filePath === javaFilePath);
                if (existingFileIndex !== -1) {
                    this.xmlFiles[existingFileIndex].xmlContent = xmlContent;
                } else {
                    this.xmlFiles.push({ filePath: javaFilePath, xmlContent });
                }
    
                this.sendUpdatedXMLFile(javaFilePath, xmlContent, WebSocketConstants.SEND_UPDATE_XML_FILE_MSG);
    
            } catch (error) {
                console.error(`Error processing ${javaFilePath}:`, error);
            }
        }
    }
    


    private async convertAllJavaFilesToXML(projectPath: string) {
        const javaFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(projectPath, '**/*.java'));
        for (const file of javaFiles) {
            const inputFilePath = file.fsPath;
            try {
                // Directly receive XML content from the conversion function
                const xmlContent = await this.convertToXML(inputFilePath);
                this.xmlFiles.push({ filePath: inputFilePath, xmlContent });
            } catch (error) {
                console.error(`Error converting ${inputFilePath} to XML:`, error);
            }
        }
    }

    private convertToXML(inputFilePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            // Adjust the command to output XML to stdout
            const command = `srcml "${inputFilePath}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    //console.error(`Error executing srcML for file ${inputFilePath}:`, error);
                    reject(error);
                } else if (stderr) {
                    console.error(`Error in srcML output for file ${inputFilePath}:`, stderr);
                    reject(new Error(stderr));
                } else {
                    //console.log(`Converted to XML: ${inputFilePath}`);
                    resolve(stdout); // stdout contains the XML content
                }
            });
        });
    }



    public async sendXmlFilesSequentially(): Promise<void> {
        if (!this.ws) {
            console.error('WebSocket is not set or connected.');
            return;
        }

        for (const { filePath, xmlContent } of this.xmlFiles) {
            const message = JSON.stringify({
                command: WebSocketConstants.SEND_XML_FILES_MSG,
                data: { filePath, xml: xmlContent }
            });

            // Wait for the send operation to complete before proceeding to the next file
            await new Promise<void>((resolve, reject) => {
                this.ws!.send(message, (error) => {
                    if (error) {
                        console.error(`Error sending XML for file ${filePath}:`, error);
                        reject(error); // Stop sending if an error occurs
                    } else {
                        //console.log(`Sent XML for file ${filePath}`);
                        resolve();
                    }
                });
            });
        }
    }

}