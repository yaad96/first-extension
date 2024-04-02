# activeDoc Extension for VSCode

This is the README for the "activeDoc" extension for VSCode.

## version 0.0.2.vsix state 
- In the webapp, if the user clicks on a generated LLM snippet, that snippet along with the explanation is now being shown in a new window in the workspace.

## version 0.0.1.vsix state 
- The search keywords of a vscode workspace is not accessible to the VSCode API users. So, `searchedElements` property is not present in the vscode extension
- In mac, clicking on a code snippet on the client (web) app is not redirecting the vscode workspace focused file's intended code snippet as it should.

## Features

- Describe the key features.
- Explain how these features improve the user experience or development process.

## Installation

### Running the Extension Codebase

1. After cloning the repo, open a terminal in the project directory.
2. Run `npm install` to install the necessary dependencies.
3. To run the extension in a development environment, press `F5` in VSCode, or click on the "Run and Debug" icon (resembles a beetle under the play icon) on the left sidebar. Then, click on the green play icon to start.

### Installing the Packaged Extension

To install the `.vsix` packaged extension:

1. Open VS Code.
2. Go to the Extensions view by clicking on the square icon on the sidebar or pressing `Ctrl+Shift+X`.
3. Click on the "..." menu at the top of the Extensions view and select "Install from VSIX...".
4. Navigate to the `.vsix` file, select it, and click "Open".

