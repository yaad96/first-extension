import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as fs from 'fs';
import { promisify } from 'util';
import { FileChangeManager } from './FileChangeManager'; // Ensure correct path is used
import { buildFolderHierarchy } from './utilites'; // Removed extra semicolon and corrected typo
//import { MessageProcessor } from './MessageProcessor';
import { WebSocketConstants } from './WebSocketConstants';
import * as path from 'path';
import { FollowAndAuthorRulesProcessor } from './FollowAndAuthorRulesProcessor';
import { MiningRulesProcessor } from './MiningRulesProcessor';
import { DoiProcessing } from './DoiProcessing';



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
            

            (async () => { // Immediately Invoked Function Expression (IIFE) for async
                if (vscode.workspace.workspaceFolders) {

                    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    const fileChangeManager = FileChangeManager.getInstance(projectPath, ws);



                    /*ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_ENTER_CHAT_MSG,
                        data: " is connected to ActiveDocumentation",
                    }));*/

                    ws.send(JSON.stringify({
                        command:WebSocketConstants.SEND_ENTER_CHAT_MSG,
                        data:"Project is connected to activedoc"
                    }));

                    /*ws.send(MessageProcessor.encodeData({
                        command: WebSocketConstants.SEND_PROJECT_PATH_MSG,
                        data: projectPath,
                    }));*/

                    ws.send(JSON.stringify({
                        command:WebSocketConstants.SEND_PROJECT_PATH_MSG,
                        data:projectPath
                    }));


                    try {
                        const projectHierarchy = buildFolderHierarchy(projectPath); // Assuming this function is properly implemented to use async/await

                        const output = {
                            command: WebSocketConstants.SEND_PROJECT_HIERARCHY_MSG,
                            data: projectHierarchy
                          };
                        
                          // Send the project hierarchy data to the connected client
                          ws.send(JSON.stringify(output));

                        //await fileChangeManager.sendXmlFilesSequentially();

                    } catch (error) {
                        console.error('Failed to generate project hierarchy:', error);
                    }

                    fileChangeManager.convertAllJavaFilesToXML(projectPath).then(() => {
                        console.log('All Java files have been converted to XML and stored.');
                        fileChangeManager.sendXmlFilesSequentially().then(() => {
                            /*ws.send(MessageProcessor.encodeData({
                                command: WebSocketConstants.SEND_TAG_TABLE_MSG,
                                data: FollowAndAuthorRulesProcessor.getInstance().getTagTableForClient()
                            }));*/
                            ws.send(JSON.stringify({
                                command: WebSocketConstants.SEND_TAG_TABLE_MSG,
                                data: FollowAndAuthorRulesProcessor.getInstance().getTagTableForClient()
                            }));

                            /*ws.send(MessageProcessor.encodeData({
                                command: WebSocketConstants.SEND_RULE_TABLE_MSG,
                                data: FollowAndAuthorRulesProcessor.getInstance().getRuleTableForClient()
                            }));*/
                            ws.send(JSON.stringify({
                                command: WebSocketConstants.SEND_RULE_TABLE_MSG,
                                data: FollowAndAuthorRulesProcessor.getInstance().getRuleTableForClient()
                            }));

                            /*ws.send(MessageProcessor.encodeData({
                                command: WebSocketConstants.SEND_VERIFY_RULES_MSG,
                                data: ""
                            }));*/
                            ws.send(JSON.stringify({
                                command: WebSocketConstants.SEND_VERIFY_RULES_MSG,
                                data: ""
                            }));
                        }).catch(error=>console.error("Error sending xml files : ",error));
                        // Here you can optionally handle the stored XML data, e.g., send via WebSocket
                    }).catch(error => console.error('Error converting Java files to XML:', error));



                    // Adding "Mine Rules" command functionality
                    context.subscriptions.push(vscode.commands.registerCommand('extension.mineRules', () => {
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            const document = editor.document;
                            const selection = editor.selection;
                            const wordRange = document.getWordRangeAtPosition(selection.start);
                            if (!wordRange) {
                                vscode.window.showInformationMessage("No word selected");
                                return;
                            }
                            const word = document.getText(wordRange);
                            const startOffset = document.offsetAt(wordRange.start);
                            const startLineOffset = wordRange.start.character;
                            const lineNumber = wordRange.start.line + 1; // VS Code lines are zero-based

                            const minigDataInfo = {
                                filePath: document.uri.fsPath,
                                startOffset: startOffset.toString(),
                                startLineOffset: startLineOffset.toString(),
                                lineNumber: lineNumber.toString(),
                                text: word
                            };


                            ws.send(JSON.stringify({
                                command: WebSocketConstants.SEND_ELEMENT_INFO_FOR_MINE_RULES,
                                data: minigDataInfo
                            }));

                            const doiProcessing = DoiProcessing.getInstance();

                            const doiData = {
                                recentVisitedFiles:doiProcessing.getVisitedFiles(),
                                recentSearches:[],
                                recentElements:[]
                            };

                            ws.send(JSON.stringify({
                                command:WebSocketConstants.SEND_DOI_INFORMATION,
                                data:doiData
                            }));


                            ws.send(JSON.stringify({
                                command: WebSocketConstants.SEND_REQUEST_MINE_RULES_FOR_ELEMENT,
                                data: ""
                            }));

                        }
                    }));




                } else {
                    console.log("No workspace found");
                }
            })().catch(error => console.error('Error in WebSocket connection handler:', error));

            ws.on('message', (message: string) => {
                console.log(`Received message: ${message}`);
                const faw = FollowAndAuthorRulesProcessor.getInstance();
                const mr = MiningRulesProcessor.getInstance();
                try {
                    const json = JSON.parse(message.toString());
                    console.log("Command:", json.command);
                    console.log("Data:", json.data);


                    if (faw.wsMessages.includes(json.command)) {
                        console.log('Received a recognized command:', json.command);
                        faw.processReceivedMessages(message);
                        // Handle the command as needed
                    }
                    else if (mr.wsMessages.includes(json.command)) {
                        console.log("in MR");
                        mr.processReceivedMessages(message);
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
