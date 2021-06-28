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

const DECOMPOSITION_FEATURE_ID = 0;
const OPTIMIZATION_FEATURE_ID = 1;

const underProcessing: string[] = [];

/**
 * An exported function for activating the decomposition plugin
 */
export function activate(context: vscode.ExtensionContext) {
	console.info('The RADON decomposition plugin is now active!');

	// Register the 'decompose' command
	const decompose = vscode.commands.registerCommand('radon-dec-plugin.decompose', (uri: vscode.Uri) => {
		runProcedure(DECOMPOSITION_FEATURE_ID, uri);
	});
	context.subscriptions.push(decompose);

	// Register the 'optimize' command
	const optimize = vscode.commands.registerCommand('radon-dec-plugin.optimize', (uri: vscode.Uri) => {
		runProcedure(OPTIMIZATION_FEATURE_ID, uri);
	});
	context.subscriptions.push(optimize);
}

/**
 * An exported function for deactivating the decomposition plugin
 */
export function deactivate() { }

/**
 * Run a specific procedure
 */
async function runProcedure(featureId: number, uri: vscode.Uri) {
	const modelPath = uri.path;
	if (underProcessing.includes(modelPath)) {
		console.info('The model is already under processing. Please wait...');
		return;
	}
	underProcessing.push(modelPath);

	const modelName = path.basename(modelPath);
	const serverConfig = getServerConfig();
	const tempName = generateTempName(modelName);
	switch (featureId) {
		case DECOMPOSITION_FEATURE_ID:
			console.info('Start architecture decomposition of ' + modelName);
			break;
		case OPTIMIZATION_FEATURE_ID:
			console.info('Start deployment optimization of ' + modelName);
			break;
		default:
			throw new Error("Unsupported feature Id: " + featureId);
	}

	try {
		let response: any;
		let output: any;

		// Upload the original model to the server
		try {
			response = await uploadFile(serverConfig, modelPath, tempName);
			console.info('Successfully uploaded the original model to the server');
		} catch (error) {
			console.error('Failed to upload the original model to the server');
			throw error;
		}

		switch (featureId) {
			case DECOMPOSITION_FEATURE_ID:
				// Decompose the architecture of the model
				try {
					response = await decomposeModel(serverConfig, tempName);
					output = JSON.parse(response.data.toString());
					console.info('Successfully decomposed the architecture of the model');
				} catch (error) {
					console.error('Failed to decompose the architecture of the model');
					throw error;
				}
				break;
			case OPTIMIZATION_FEATURE_ID:
				// Optimize the deployment of the model
				try {
					response = await optimizeModel(serverConfig, tempName);
					output = JSON.parse(response.data.toString());
					console.info('Successfully optimized the deployment of the model');
				} catch (error) {
					console.error('Failed to optimize the deployment of the model');
					throw error;
				}
				break;
			default:
				throw new Error("Unsupported feature Id: " + featureId);
		}

		// Download the resultant model from the server
		try {
			response = await downloadFile(serverConfig, tempName);
			backUpFile(modelPath);
			writeFile(modelPath, response.data);
			console.info('Successfully downloaded the resultant model from the server');
		} catch (error) {
			console.error('Failed to download the resultant model from the server');
			throw error;
		}

		switch (featureId) {
			case DECOMPOSITION_FEATURE_ID:
				// Print the output upon completion of decomposition
				console.info('Architecture decomposition of ' + modelName + ' complete');
				console.info(JSON.stringify(output, null, 2));
				break;
			case OPTIMIZATION_FEATURE_ID:
				// Print the output upon completion of optimization
				console.info('Deployment optimization of ' + modelName + ' complete');
				console.info(JSON.stringify(output, null, 2));
				console.info('Total operating cost per year: ' + output.total_cost * 24 * 356);
				break;
			default:
				throw new Error("Unsupported feature Id: " + featureId);
		}
	} catch (error) {
		// Print the error upon failure of a request
		console.error(JSON.stringify(error, null, 2));
	} finally {
		// Delete the residual model from the server
		try { await deleteFile(serverConfig, tempName); } catch { }
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
		path: '/files/' + fileName,
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
		path: '/files/' + fileName,
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
		path: '/files/' + fileName,
		method: 'DELETE',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Decompose the architecture of a RADON model
 */
function decomposeModel(serverConfig: any, fileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/dec-tool/decompose?filename=' + fileName,
		method: 'PATCH',
		headers: {
			'Content-Length': 0
		}
	});
}

/**
 * Optimize the deployment of a RADON model
 */
function optimizeModel(serverConfig: any, fileName: string): Promise<any> {
	return sendRequest({
		host: serverConfig.domainName,
		port: serverConfig.publicPort,
		path: '/dec-tool/optimize?filename=' + fileName,
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
