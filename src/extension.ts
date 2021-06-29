/**
 * Copyright (c) 2019, Imperial College London
 * All rights reserved.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as FormData from 'form-data';
import * as http from 'http';
import * as Stream from 'stream';

const outputChannel = vscode.window.createOutputChannel('RADON Decomposition');
const underProcessing: string[] = [];

/**
 * An exported function for activating the decomposition plugin
 */
export function activate(context: vscode.ExtensionContext) {
	outputChannel.appendLine('The RADON decomposition plugin is now active!');

	// Register the 'decompose' command
	const decompose = vscode.commands.registerCommand('radon-dec-plugin.decompose', (uri: vscode.Uri) => {
		runDecomposition(uri);
	});
	context.subscriptions.push(decompose);

	// Register the 'optimize' command
	const optimize = vscode.commands.registerCommand('radon-dec-plugin.optimize', (uri: vscode.Uri) => {
		runOptimization(uri);
	});
	context.subscriptions.push(optimize);

	// Register the 'enhance' command
	const enhance = vscode.commands.registerCommand('radon-dec-plugin.enhance', (uri: vscode.Uri) => {
		runEnhancement(uri);
	});
	context.subscriptions.push(enhance);
}

/**
 * An exported function for deactivating the decomposition plugin
 */
export function deactivate() { }

/**
 * Run architecture decomposition
 */
async function runDecomposition(uri: vscode.Uri) {
	outputChannel.show();

	// Check if the model is already under processing
	const modelPath = uri.path;
	if (underProcessing.includes(modelPath)) {
		outputChannel.appendLine('The model is already under processing. Please wait...');
		return;
	}

	// Gather necessary information
	const serverConfig = getServerConfig();
	const modelFileName = path.basename(modelPath);
	const modelTempName = generateTempName(modelFileName);

	// Start execution of the procedure
	outputChannel.appendLine('Start architecture decomposition of ' + modelFileName);
	underProcessing.push(modelPath);
	try {
		let response = null;
		let output = null;

		// Upload the model to the server
		try {
			response = await uploadFile(serverConfig, modelPath, modelTempName);
			outputChannel.appendLine('Successfully uploaded the model to the server');
		} catch (error) {
			outputChannel.appendLine('Failed to upload the model to the server');
			throw error;
		}

		// Decompose the architecture of the model
		try {
			response = await decomposeModel(serverConfig, modelTempName);
			output = JSON.parse(response.data.toString());
			outputChannel.appendLine('Successfully decomposed the architecture of the model');
		} catch (error) {
			outputChannel.appendLine('Failed to decompose the architecture of the model');
			throw error;
		}

		// Download the model from the server
		try {
			response = await downloadFile(serverConfig, modelTempName);
			backUpFile(modelPath);
			writeFile(modelPath, response.data);
			outputChannel.appendLine('Successfully downloaded the model from the server');
		} catch (error) {
			outputChannel.appendLine('Failed to download the model from the server');
			throw error;
		}

		// Print the output upon completion
		outputChannel.appendLine('Architecture decomposition of ' + modelFileName + ' complete');
		outputChannel.appendLine(JSON.stringify(output, null, 2));
	} catch (error) {
		// Print the error if a request fails
		outputChannel.appendLine(JSON.stringify(error, null, 2));
	} finally {
		// Delete the model from the server
		try { await deleteFile(serverConfig, modelTempName); } catch { }
		underProcessing.splice(underProcessing.indexOf(modelPath));
	}
}

/**
 * Run deployment optimization
 */
async function runOptimization(uri: vscode.Uri) {
	outputChannel.show();

	// Check if the model is already under processing
	const modelPath = uri.path;
	if (underProcessing.includes(modelPath)) {
		outputChannel.appendLine('The model is already under processing. Please wait...');
		return;
	}

	// Gather necessary information
	const serverConfig = getServerConfig();
	const modelFileName = path.basename(modelPath);
	const modelTempName = generateTempName(modelFileName);

	// Start execution of the procedure
	outputChannel.appendLine('Start deployment optimization of ' + modelFileName);
	underProcessing.push(modelPath);
	try {
		let response = null;
		let output = null;

		// Upload the model to the server
		try {
			response = await uploadFile(serverConfig, modelPath, modelTempName);
			outputChannel.appendLine('Successfully uploaded the model to the server');
		} catch (error) {
			outputChannel.appendLine('Failed to upload the model to the server');
			throw error;
		}

		// Optimize the deployment of the model
		try {
			response = await optimizeModel(serverConfig, modelTempName);
			output = JSON.parse(response.data.toString());
			outputChannel.appendLine('Successfully optimized the deployment of the model');
		} catch (error) {
			outputChannel.appendLine('Failed to optimize the deployment of the model');
			throw error;
		}

		// Download the model from the server
		try {
			response = await downloadFile(serverConfig, modelTempName);
			backUpFile(modelPath);
			writeFile(modelPath, response.data);
			outputChannel.appendLine('Successfully downloaded the model from the server');
		} catch (error) {
			outputChannel.appendLine('Failed to download the model from the server');
			throw error;
		}

		// Print the output upon completion
		outputChannel.appendLine('Deployment optimization of ' + modelFileName + ' complete');
		outputChannel.appendLine(JSON.stringify(output, null, 2));
		outputChannel.appendLine('Total operating cost per year: ' + output.total_cost * 24 * 356);
	} catch (error) {
		// Print the error if a request fails
		outputChannel.appendLine(JSON.stringify(error, null, 2));
	} finally {
		// Delete the model from the server
		try { await deleteFile(serverConfig, modelTempName); } catch { }
		underProcessing.splice(underProcessing.indexOf(modelPath));
	}
}

/**
 * Run accuracy enhancement
 */
async function runEnhancement(uri: vscode.Uri) {
	outputChannel.show();

	// Check if the model is already under processing
	const modelPath = uri.path;
	if (underProcessing.includes(modelPath)) {
		outputChannel.appendLine('The model is already under processing. Please wait...');
		return;
	}

	// Gather necessary information
	const serverConfig = getServerConfig();
	const modelFileName = path.basename(modelPath);
	const modelTempName = generateTempName(modelFileName);
	let dataFileName = '';
	const directoryPath = path.dirname(modelPath);
	const directoryEntries = fs.readdirSync(directoryPath, { withFileTypes: true });
	for (const entry of directoryEntries) {
		if (entry.isFile() && entry.name.endsWith('.log')) {
			dataFileName = entry.name;
		}
	}
	if (!dataFileName) {
		outputChannel.appendLine('Cannot find the data file (.log)');
		return;
	}
	const dataPath = path.join(directoryPath, dataFileName);
	const dataTempName = generateTempName(dataFileName);

	// Start execution of the procedure
	outputChannel.appendLine('Start accuracy enhancement of ' + modelFileName);
	underProcessing.push(modelPath);
	try {
		let response = null;
		let output = null;

		// Upload the model to the server
		try {
			response = await uploadFile(serverConfig, modelPath, modelTempName);
			outputChannel.appendLine('Successfully uploaded the model to the server');
		} catch (error) {
			outputChannel.appendLine('Failed to upload the model to the server');
			throw error;
		}

		// Upload the data to the server
		try {
			response = await uploadFile(serverConfig, dataPath, dataTempName);
			outputChannel.appendLine('Successfully uploaded the data to the server');
		} catch (error) {
			outputChannel.appendLine('Failed to upload the data to the server');
			throw error;
		}

		// Enhance the accuracy of the model
		try {
			response = await enhanceModel(serverConfig, modelTempName, dataTempName);
			output = JSON.parse(response.data.toString());
			outputChannel.appendLine('Successfully enhanced the accuracy of the model');
		} catch (error) {
			outputChannel.appendLine('Failed to enhance the accuracy of the model');
			throw error;
		}

		// Download the model from the server
		try {
			response = await downloadFile(serverConfig, modelTempName);
			backUpFile(modelPath);
			writeFile(modelPath, response.data);
			outputChannel.appendLine('Successfully downloaded the model from the server');
		} catch (error) {
			outputChannel.appendLine('Failed to download the model from the server');
			throw error;
		}

		// Print the output upon completion
		outputChannel.appendLine('Accuracy enhancement of ' + modelFileName + ' complete');
		outputChannel.appendLine(JSON.stringify(output, null, 2));
	} catch (error) {
		// Print the error if a request fails
		outputChannel.appendLine(JSON.stringify(error, null, 2));
	} finally {
		// Delete the model and data from the server
		try { await deleteFile(serverConfig, modelTempName); } catch { }
		try { await deleteFile(serverConfig, dataTempName); } catch { }
		underProcessing.splice(underProcessing.indexOf(modelPath));
	}
}

/**
 * Get the server configuration
 */
function getServerConfig(): any {
	const pluginConfig = vscode.workspace.getConfiguration('radon-dec-plugin');
	return {
		domainName: pluginConfig.get<string>('server.domainName'),
		publicPort: pluginConfig.get<number>('server.publicPort')
	};
}

/**
 * Generate a temporary name for a file
 */
function generateTempName(fileName: string): string {
	const extName = path.extname(fileName);
	const baseName = path.basename(fileName, extName);
	return baseName + '_' + uuid.v4() + extName;
}

/**
 * Send an HTTP request
 */
function sendRequest(options: http.RequestOptions, stream?: Stream): Promise<any> {
	return new Promise((resolve, reject) => {
		const request = http.request(options, (response) => {
			let chunks: any[] = [];
			response.on('data', (chunk) => {
				chunks.push(chunk);
			});
			response.on('error', (error) => {
				reject(error);
			});
			response.on('end', () => {
				const result = Buffer.concat(chunks);
				if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
					resolve({
						statusCode: response.statusCode,
						data: result
					});
				} else {
					reject(JSON.parse(result.toString()));
				}
			});
		});
		request.on('error', (error) => {
			reject(error);
		});
		if (stream) {
			stream.pipe(request);
		} else {
			request.end();
		}
	});
}

/**
 * Upload a file to the server
 */
function uploadFile(serverConfig: any, uploadPath: string, fileName: string): Promise<any> {
	const formData = new FormData();
	formData.append('file', fs.createReadStream(uploadPath));
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/file/' + fileName,
		method: 'POST',
		headers: formData.getHeaders()
	}, formData);
}

/**
 * Download a file from the server
 */
function downloadFile(serverConfig: any, fileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/file/' + fileName,
		method: 'GET',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Delete a file in the server
 */
function deleteFile(serverConfig: any, fileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/file/' + fileName,
		method: 'DELETE',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Decompose the architecture of a RADON model
 */
function decomposeModel(serverConfig: any, modelFileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/dec-tool/decompose?model_filename=' + modelFileName,
		method: 'PATCH',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Optimize the deployment of a RADON model
 */
function optimizeModel(serverConfig: any, modelFileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/dec-tool/optimize?model_filename=' + modelFileName,
		method: 'PATCH',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Enhance the accuracy of a RADON model
 */
function enhanceModel(serverConfig: any, modelFileName: string, dataFileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/dec-tool/enhance?model_filename=' + modelFileName + '&data_filename=' + dataFileName,
		method: 'PATCH',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Back up a file in place
 */
function backUpFile(filePath: string) {
	for (let i = 1; i < Number.MAX_SAFE_INTEGER; i++) {
		let backupPath = filePath + '.bkp';
		if (i > 1) {
			backupPath = backupPath + i;
		}
		if (!fs.existsSync(backupPath)) {
			fs.copyFileSync(filePath, backupPath);
			break;
		}
	}
}

/**
 * Write a buffer to a file
 */
function writeFile(filePath: string, buffer: Buffer) {
	const fileId = fs.openSync(filePath, 'w');
	fs.writeSync(fileId, buffer);
	fs.closeSync(fileId);
}
