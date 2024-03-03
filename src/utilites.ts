import * as vscode from 'vscode';
import { exec } from "child_process";
import * as path from 'path';
import { writeFile } from 'fs/promises';
import { Constants } from './Constants';
import * as os from 'os';
import * as fs from 'fs';




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



interface FileProperties {
  canonicalPath: string;
  parent: string;
  name: string;
  isDirectory: boolean;
  fileType?: string; // Optional, only for files
  fileName?: string; // Optional, added property for file name including extension
}


interface DirectoryJson {
children: DirectoryJson[];
properties: FileProperties;
}

export function buildFolderHierarchy(rootPath: string): DirectoryJson | null {
const stats = fs.statSync(rootPath);
if (!stats.isDirectory()) {
  return null; // rootPath is not a directory
}

const rootDirectory: DirectoryJson = {
  children: [],
  properties: {
    canonicalPath: rootPath,
    parent: "",
    name: path.basename(rootPath),
    isDirectory: true,
  },
};

function traverseDirectory(currentPath: string, parentNode: DirectoryJson) {
  fs.readdirSync(currentPath, { withFileTypes: true }).forEach((dirent) => {
    const fullPath = path.join(currentPath, dirent.name);
    const isDirectory = dirent.isDirectory();
    const childNode: DirectoryJson = {
      children: [],
      properties: {
        canonicalPath: fullPath.replace(/\\/g, '/'),
        parent: currentPath.replace(/\\/g, '/'),
        name: isDirectory ? dirent.name : path.basename(dirent.name, path.extname(dirent.name)),
        isDirectory: isDirectory,
        // Include fileName for files
        ...(isDirectory ? {} : { fileName: dirent.name }) // Conditionally add fileName if it's a file
      },
    };

    if (!isDirectory) {
      // Include fileType for files
      if (shouldIgnoreFileForProjectHierarchy(fullPath)) return;
      childNode.properties.fileType = path.extname(dirent.name).substring(1);
    }

    parentNode.children.push(childNode);

    // Recursively traverse if it's a directory
    if (isDirectory) {
      traverseDirectory(fullPath, childNode);
    }
  });
}


traverseDirectory(rootPath, rootDirectory);
return rootDirectory;
}

function shouldIgnoreFileForProjectHierarchy(filePath: string): boolean {
//const TEMP_JAVA_FILE = "Temp.java"; // Adjust this to your temporary Java file's criteria
// Ignore non-Java files and the specific temporary Java file
return !filePath.endsWith('.java') || path.basename(filePath) === Constants.TEMP_JAVA_FILE;
}




