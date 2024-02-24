import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as fs from 'fs';
import { promisify } from 'util';
import { FileChangeManager } from './FileChangeManager'; // Ensure correct path is used
import { generateProjectHierarchyAsJSON } from './utilites'; // Removed extra semicolon and corrected typo
import { MessageProcessor } from './MessageProcessor';
import { WebSocketConstants } from './WebSocketConstants';
import * as path from 'path';
import { FollowAndAuthorRulesProcessor} from './FollowAndAuthorRulesProcessor';


//const readFileAsync = promisify(fs.readFile);

const port = 9000;



export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "ActiveDocumentation" is now active.');
    //console.log("All xml files created");

    const server = new WebSocket.Server({ port });
    console.log(`WebSocket server started on port: ${port}`);

    if (vscode.workspace.workspaceFolders) {

        server.on('connection', (ws) => {

            console.log('Client connected');
            //fileChangeManager.setWebSocket(ws);

            (async () => { // Immediately Invoked Function Expression (IIFE) for async
                if (vscode.workspace.workspaceFolders) {

                    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    const fileChangeManager = FileChangeManager.getInstance(projectPath, ws);

                    ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_ENTER_CHAT_MSG,
                        data: " is connected to ActiveDocumentation",
                    }));


                    ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_PROJECT_PATH_MSG,
                        data: projectPath,
                    }));



                    try {
                        const projectHierarchy = await generateProjectHierarchyAsJSON(); // Assuming this function is properly implemented to use async/await
                        ws.send(MessageProcessor.encodeData({
                            command: WebSocketConstants.SEND_PROJECT_HIERARCHY_MSG,
                            data: JSON.stringify(projectHierarchy),
                        }));

                        await fileChangeManager.sendXmlFilesSequentially();

                    } catch (error) {
                        console.error('Failed to generate project hierarchy:', error);
                    }

                    ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_TAG_TABLE_MSG,
                        data: FollowAndAuthorRulesProcessor.getInstance().getTagTableForClient()
                    }));

                    ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_RULE_TABLE_MSG,
                        data: FollowAndAuthorRulesProcessor.getInstance().getRuleTableForClient()
                    }));

                    ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_VERIFY_RULES_MSG,
                        data: ""
                    }));




                } else {
                    console.log("No workspace found");
                }
            })().catch(error => console.error('Error in WebSocket connection handler:', error));

            ws.on('message', (message: string) => {
                console.log(`Received message: ${message}`);
                const faw = FollowAndAuthorRulesProcessor.getInstance();
                try {
                    const json= JSON.parse(message.toString());
                    console.log("Command:", json.command);
                    console.log("Data:", json.data);
                    // Accessing deeper properties
                    /*
                    console.log("Tag ID:", json.data.tagID);
                    console.log("Tag Info:", json.data.tagInfo);
                    console.log("Tag Name:", json.data.tagInfo.tagName);
                    console.log("Tag Detail:", json.data.tagInfo.detail);
                    */

                    if (faw.wsMessages.includes(json.command)) {
                        console.log('Received a recognized command:', json.command);
                        faw.processReceivedMessages(message);
                        // Handle the command as needed
                    }
                } catch (e) {
                    console.error("Error parsing JSON:", e);
                }
                



            });

            ws.on('error', (error) => {
                console.error(`WebSocket error: ${error}`);
            });

            ws.on('close', () => {
                console.log('Client disconnected');
            });
        });
    }





    context.subscriptions.push(vscode.commands.registerCommand('first-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from ActiveDocumentation!');
    }));

    // Ensure the server is closed when the extension is deactivated
    context.subscriptions.push(new vscode.Disposable(() => server.close()));
}

export function deactivate() { }
