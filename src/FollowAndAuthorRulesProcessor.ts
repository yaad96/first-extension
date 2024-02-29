import * as vscode from 'vscode';
import WebSocket from 'ws';
import * as fs from 'fs/promises'; // Use fs/promises for readFile
import * as path from 'path';
import { WebSocketConstants } from './WebSocketConstants';
//import { MessageProcessor } from './MessageProcessor';
import { Constants } from './Constants';
import * as fs1 from 'fs';
import { FileChangeManager } from './FileChangeManager';
import { writeToFile, convertToXML, findLineNumber } from './utilites';



interface Tag {
    ID: string;
    tagName: string;
    detail: string;
}



export class FollowAndAuthorRulesProcessor {
    private static instance: FollowAndAuthorRulesProcessor | null = null;
    private ws: WebSocket | null;
    private ruleTable: any[]; // Consider using a more specific type
    private tagTable: Tag[];
    private currentProjectPath: string;
    public readonly wsMessages: string[] = [
        WebSocketConstants.RECEIVE_SNIPPET_XML_MSG,
        WebSocketConstants.RECEIVE_MODIFIED_RULE_MSG,
        WebSocketConstants.RECEIVE_MODIFIED_TAG_MSG,
        WebSocketConstants.RECEIVE_CODE_TO_XML_MSG,
        WebSocketConstants.RECEIVE_NEW_RULE_MSG,
        WebSocketConstants.RECEIVE_NEW_TAG_MSG,
    ];

    public constructor(currentProjectPath: string, ws: WebSocket | null) {
        this.currentProjectPath = currentProjectPath;
        this.ws = ws;
        this.tagTable = [];
        this.ruleTable = []; // Initialize as an empty array
        this.loadTagTable();
        this.loadRuleTable();
    }

    public static getInstance(currentProjectPath: string = "", ws: WebSocket | null = null): FollowAndAuthorRulesProcessor {
        if (this.instance === null) {
            this.instance = new FollowAndAuthorRulesProcessor(currentProjectPath, ws);
        }
        return this.instance;
    }

    private async loadTagTable(): Promise<void> {
        const tagTablePath = path.join(this.currentProjectPath, Constants.TAG_TABLE_JSON);
        try {
            const data = await fs.readFile(tagTablePath, { encoding: 'utf8' });
            this.tagTable = JSON.parse(data);
        } catch (error) {
            console.error('Failed to load tag table:', error);
        }
    }

    private async loadRuleTable(): Promise<void> {
        const ruleTablePath = path.join(this.currentProjectPath, Constants.RULE_TABLE_JSON);
        try {
            const data = await fs.readFile(ruleTablePath, { encoding: 'utf8' });
            this.ruleTable = JSON.parse(data);
        } catch (error) {
            console.error('Failed to load rule table:', error);
        }
    }

    public updateProjectWs(projectPath: string, ws: WebSocket): void {
        this.currentProjectPath = projectPath;
        this.ws = ws;
        this.loadTagTable();
        this.loadRuleTable();
    }

    public getRuleTableForClient(): string {
        const ruleTableData = JSON.stringify(this.ruleTable);
        return ruleTableData;
    }

    public getTagTableForClient(): string {
        const tagTableData = JSON.stringify(this.tagTable);
        return tagTableData;
    }

    public async processReceivedMessages(message: string): Promise<void> {
        const jsonData = JSON.parse(message.toString());
        const command = jsonData.command;

        switch (command) {
            case WebSocketConstants.RECEIVE_SNIPPET_XML_MSG:
                // Handle RECEIVE_SNIPPET_XML_MSG
                const xmlString = jsonData.data.xml;


                const tempXmlFilePath = path.join(this.currentProjectPath, Constants.TEMP_XML_FILE);
                const xmlHeader = Constants.XML_HEADER;

                // Write XML to temporary file
                fs.writeFile(tempXmlFilePath, xmlHeader + xmlString, { encoding: 'utf8' });

                // Open the specified file
                //we are getting the full path from the client 
                const fileUri = vscode.Uri.file(jsonData.data.fileName);
                const document = await vscode.workspace.openTextDocument(fileUri);
                const editor = await vscode.window.showTextDocument(document);

                try {
                    const positionString = await findLineNumber(tempXmlFilePath);
                    // Calculate the position based on the XML length
                    const positionIndex = positionString.length;

                    // Find the position in the document
                    const charPosition = document.positionAt(positionIndex);

                    // Get the entire line where the character is located
                    const line = document.lineAt(charPosition.line);

                    // Use the start and end of the line for startPosition and endPosition
                    const startPosition = line.range.start;
                    const endPosition = line.range.end;

                    // Move the cursor and highlight the whole line
                    editor.selection = new vscode.Selection(startPosition, endPosition);
                    editor.revealRange(new vscode.Range(startPosition, endPosition), vscode.TextEditorRevealType.InCenter);
                } catch (error) {
                    console.error("An error occurred:");
                    console.error(error); // Handle the error
                }


                break;
            case WebSocketConstants.RECEIVE_MODIFIED_RULE_MSG:
                // Extract ruleID and ruleInfo from jsonData.data
                const ruleID = jsonData.data.ruleID;
                const ruleInfo = jsonData.data.ruleInfo;
                const ruleExists = this.checkRuleExists(ruleID, ruleInfo);
                if (ruleExists) {
                    const ruleIndex = this.ruleTable.findIndex(rule => rule.index === ruleID);
                    this.ruleTable[ruleIndex] = ruleInfo;
                    this.updateRuleTableFile();

                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_UPDATE_RULE_MSG,
                        data: jsonData.data
                    }));

                }
                else {
                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_FAILED_UPDATE_RULE_MSG,
                        data: jsonData.data
                    }));
                }
                // Update the rule by ruleID with ruleInfo here
                break;
            case WebSocketConstants.RECEIVE_MODIFIED_TAG_MSG:
                // Extract tagID and tagInfo from jsonData.data
                const updateTagID = jsonData.data.tagID;
                const updateTagInfo = jsonData.data.tagInfo;
                var data = {
                    ID: jsonData.data.tagInfo.ID,
                    tagName: jsonData.data.tagInfo.tagName,
                    detail: jsonData.data.tagInfo.detail
                };
                // Update the tag by tagID with tagInfo here
                const tagExists = this.checkTagExists(updateTagID, updateTagInfo);
                if (tagExists) {
                    const tagIndex = this.tagTable.findIndex(tag => tag.ID === updateTagID);
                    this.tagTable[tagIndex] = updateTagInfo;
                    this.updateTagTableFile();

                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_UPDATE_TAG_MSG,
                        data: data
                    }));

                }
                else {
                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_FAILED_UPDATE_TAG_MSG,
                        data: data
                    }));
                }

                break;
            case WebSocketConstants.RECEIVE_CODE_TO_XML_MSG:
                // Handle conversion of code to XML and respond back
                const plainCode = jsonData.data.codeText;
                const tempJavaFilePath = path.join(this.currentProjectPath, Constants.TEMP_JAVA_FILE);
                writeToFile(tempJavaFilePath, plainCode);
                if (tempJavaFilePath.endsWith('.java')) {


                    try {
                        const xmlContent = await convertToXML(tempJavaFilePath); // Adjusted call
                        this.ws?.send(JSON.stringify({
                            command: WebSocketConstants.SEND_XML_FROM_CODE_MSG,
                            data: {
                                xmlText: xmlContent,
                                messageID: jsonData.data.messageID
                            }
                        }));


                    } catch (error) {
                        console.error(`Error processing newly created file ${tempJavaFilePath}:`, error);
                    }
                }

                //const resultXML = FileChangeManager.getInstance(this.currentProjectPath,this.ws).convertToXML(tempJavaFilePath) 


                break;
            case WebSocketConstants.RECEIVE_NEW_RULE_MSG:
                // Handle new rule creation from jsonData.data
                const newRuleID = jsonData.data.ruleID;
                const newRuleInfo = jsonData.data.ruleInfo;

                const ruleAlreadyExists = this.checkRuleExists(newRuleID, newRuleInfo);
                if (ruleAlreadyExists) {

                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_FAILED_NEW_RULE_MSG,
                        data: jsonData.data
                    }));

                }
                else {
                    //console.log("here");
                    this.ruleTable.push(newRuleInfo);
                    this.updateRuleTableFile();
                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_NEW_RULE_MSG,
                        data: jsonData.data
                    }));

                }

                break;
            case WebSocketConstants.RECEIVE_NEW_TAG_MSG:
                // Similar to the Java version, parse the jsonData for new tag info and process it
                const newTagID = jsonData.data.tagID;
                const newTagInfo = jsonData.data.tagInfo;
                data = {
                    ID: jsonData.data.tagInfo.ID,
                    tagName: jsonData.data.tagInfo.tagName,
                    detail: jsonData.data.tagInfo.detail
                };


                const tagAlreadyExists = this.checkTagExists(newTagID, newTagInfo);
                if (tagAlreadyExists) {


                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_FAILED_NEW_TAG_MSG,
                        data: data
                    }));


                }
                else {
                    this.tagTable.push(newTagInfo);
                    this.updateTagTableFile();
                    this.ws?.send(JSON.stringify({
                        command: WebSocketConstants.SEND_NEW_TAG_MSG,
                        data: data
                    }));
                }
                // Add a new tag based on newTagID and newTagInfo here
                break;
            // Add other case statements as necessary
            default:
                console.log(`Unrecognized command: ${command}`);
        }

    }

    private checkRuleExists(newRuleID: string, newRuleInfo: any): boolean {
        if (newRuleID !== newRuleInfo.index) {
            console.error("Mismatched IDs");
            return true;
        }

        const ruleExists = this.ruleTable.some(rule => rule.index === newRuleID);
        if (ruleExists) {
            return true;
        }
        return false;
    }

    private checkTagExists(newTagID: string, newTagInfo: Tag): boolean {


        // Ensure the ID in the newTagInfo matches newTagID
        if (newTagInfo.ID !== newTagID) {
            console.error("Mismatched IDs");
            return true;
        }

        // Check if the tagTable already contains a tag with the newTagID
        const tagExists = this.tagTable.some(tag => tag.ID === newTagID);
        if (tagExists) {
            // Tag already exists, return true
            return true;
        }
        return false;
    }


    private async updateRuleTableFile() {
        const ruleTablePath = path.join(this.currentProjectPath, Constants.RULE_TABLE_JSON); // Adjust __dirname to your project's root path as necessary

        // Read the existing tag table
        fs1.readFile(ruleTablePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file table:', err);
                return;
            }

            // Parse the existing tag table and append new tag info
            //const tagTable = JSON.parse(data);


            // Write the updated tag table back to the file
            fs1.writeFile(ruleTablePath, JSON.stringify(this.ruleTable, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing the updated rule table:', err);
                } else {
                    console.log('rule info successfully appended to tagTable.json');
                }
            });
        });
    }



    private async updateTagTableFile() {
        const tagTablePath = path.join(this.currentProjectPath, Constants.TAG_TABLE_JSON); // Adjust __dirname to your project's root path as necessary

        // Read the existing tag table
        fs1.readFile(tagTablePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the tag table:', err);
                return;
            }

            // Parse the existing tag table and append new tag info
            //const tagTable = JSON.parse(data);


            // Write the updated tag table back to the file
            fs1.writeFile(tagTablePath, JSON.stringify(this.tagTable, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing the updated tag table:', err);
                } else {
                    console.log('Tag info successfully appended to tagTable.json');
                }
            });
        });
    }



}
