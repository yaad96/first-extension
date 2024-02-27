import * as vscode from 'vscode';
import { exec } from "child_process";
import * as path from 'path';
import { writeFile } from 'fs/promises';
import { Constants } from './Constants';
import * as os from 'os';



export async function writeToFile(filePath: string, exprText: string): Promise<void> {
  try {
    await writeFile(filePath, exprText, 'utf-8');
    console.log("File written successfully");
  } catch (e) {
    console.error("Error in writing the result xml", e);
  }
}

export function convertToXML(inputFilePath: string): Promise<string> {
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

export function findLineNumber(xmlFilePath: string): Promise<string> {
  const platform = os.platform();
  console.log(`The system is running on: ${platform}`);


  return new Promise((resolve, reject) => {
    // Construct the command
    const command = "";


    if (platform === 'win32') {
      const command = `"${Constants.SRCML_PATH_WINDOWS}" --unit 1 "${xmlFilePath}"`;
      console.log('This is a Windows system.');
    } else if (platform === 'darwin') {
      const command = `"${Constants.SRCML_PATH_MAC}" --unit 1 "${xmlFilePath}"`;
      console.log('This is a macOS system.');
    } else if (platform === 'linux') {
      const command = `"${Constants.SRCML_PATH_LINUX}" --unit 1 "${xmlFilePath}"`;
      console.log('This is a Linux system.');
    } else {
      console.log('Unknown or unsupported operating system.');
      return;
    }


    // Execute the command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Execution error: ${error}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Error: ${stderr}`);
        return reject(stderr);
      }
      resolve(stdout); // Resolve the promise with the command's output
    });
  });
}







// Define interfaces for hierarchy structure


interface FileProperties {
  canonicalPath: string;
  parent: string;
  name: string;
  isDirectory: boolean;
  fileType?: string;
}

interface HierarchyNode {
  properties: FileProperties;
  children?: HierarchyNode[];
}



export async function generateProjectHierarchyAsJSON(): Promise<HierarchyNode | {}> {
  // Ensure there's at least one workspace folder open
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return {};
  }

  const projectPath = vscode.workspace.workspaceFolders[0].uri;
  return buildHierarchy(projectPath);
}

async function buildHierarchy(uri: vscode.Uri): Promise<HierarchyNode> {
  const children = await vscode.workspace.fs.readDirectory(uri);
  const hierarchy: HierarchyNode = {
    properties: {
      canonicalPath: uri.fsPath,
      parent: uri.path.split('/').slice(0, -1).join('/') || "",
      name: uri.path.split('/').pop() || "",
      isDirectory: true
    },
    children: []
  };

  for (const [childName, fileType] of children) {
    const childUri = vscode.Uri.joinPath(uri, childName);
    if (fileType === vscode.FileType.Directory) {
      hierarchy.children!.push(await buildHierarchy(childUri));
    } else {
      hierarchy.children!.push({
        properties: {
          canonicalPath: childUri.fsPath,
          parent: uri.fsPath,
          name: childName,
          isDirectory: false,
          fileType: fileType === vscode.FileType.File ? "File" : "Other"
        }
      });
    }
  }

  return hierarchy;
}
