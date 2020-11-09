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

let underProcessing: string[] = [];

/**
 * An exported function for activating the decomposition plugin
 */
export function activate(context: vscode.ExtensionContext) {

	console.info('The RADON decomposition plugin is now active!');

	// Register the 'decompose' command
	let decompose = vscode.commands.registerCommand('radon-dec-plugin.decompose', (uri: vscode.Uri) => {
		const modelPath = uri.path;
		if (underProcessing.includes(modelPath)) {
			console.info('The model is already under processing. Please wait...');
			return;
		}
		underProcessing.push(modelPath);

		const modelName = path.basename(modelPath);
		console.info('Start architecture decomposition of ' + modelName);

		const serverConfig = getServerConfig();
		const tempName = generateTempName(modelName);
		new Promise((resolve, reject) => {
			// Upload the original model to the server
			uploadFile(serverConfig, modelPath, tempName, (response) => {
				if (response.statusCode === 200) {
					console.info('Successfully uploaded the original model to the server');
					resolve({});
				} else {
					console.error('Failed to upload the original model to the server');
					reject(response);
				}
			});
		}).then((extraInfo: any) => {
			return new Promise((resolve, reject) => {
				// Decompose the architecture of the model
				decomposeModel(serverConfig, tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully decomposed the architecture of the model');
						resolve(extraInfo);
					} else {
						console.error('Failed to decompose the architecture of the model');
						reject(response);
					}
				});
			});
		}).then((extraInfo: any) => {
			return new Promise((resolve, reject) => {
				// Download the resultant model from the server
				downloadFile(serverConfig, tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully downloaded the resultant model from the server');
						backUpFile(modelPath);
						response.pipe(fs.createWriteStream(modelPath));
						resolve(extraInfo);
					} else {
						console.error('Failed to download the resultant model from the server');
						reject(response);
					}
				});
			});
		}).then((extraInfo: any) => {
			// Clean up the server and show extra information
			deleteFile(serverConfig, tempName, (response) => {
				console.info('Architecture decomposition of ' + modelName + ' complete');
				console.info(JSON.stringify(extraInfo, null, 2));
				underProcessing.splice(underProcessing.indexOf(modelPath));
			});
		}).catch((reason) => {
			// Print the reason if a request fails or an error occurs
			printReason(reason);
			underProcessing.splice(underProcessing.indexOf(modelPath));
		});
	});
	context.subscriptions.push(decompose);

	// Register the 'optimize' command
	let optimize = vscode.commands.registerCommand('radon-dec-plugin.optimize', (uri: vscode.Uri) => {
		const modelPath = uri.path;
		if (underProcessing.includes(modelPath)) {
			console.info('The model is already under processing. Please wait...');
			return;
		}
		underProcessing.push(modelPath);

		const modelName = path.basename(modelPath);
		console.info('Start deployment optimization of ' + modelName);

		const serverConfig = getServerConfig();
		const tempName = generateTempName(modelName);
		new Promise((resolve, reject) => {
			// Upload the original model to the server
			uploadFile(serverConfig, modelPath, tempName, (response) => {
				if (response.statusCode === 200) {
					console.info('Successfully uploaded the original model to the server');
					resolve({});
				} else {
					console.error('Failed to upload the original model to the server');
					reject(response);
				}
			});
		}).then((extraInfo: any) => {
			return new Promise((resolve, reject) => {
				// Optimize the deployment of the model
				optimizeModel(serverConfig, tempName, (response) => {
					if (response.statusCode === 200) {
						let text = '';
						response.on('data', (chunk) => {
							text += chunk;
						});
						response.on('end', () => {
							console.info('Successfully optimized the deployment of the model');
							Object.assign(extraInfo, JSON.parse(text));
							resolve(extraInfo);
						});
					} else {
						console.error('Failed to optimize the deployment of the model');
						reject(response);
					}
				});
			});
		}).then((extraInfo: any) => {
			return new Promise((resolve, reject) => {
				// Download the resultant model from the server
				downloadFile(serverConfig, tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully downloaded the resultant model from the server');
						backUpFile(modelPath);
						response.pipe(fs.createWriteStream(modelPath));
						resolve(extraInfo);
					} else {
						console.error('Failed to download the resultant model from the server');
						reject(response);
					}
				});
			});
		}).then((extraInfo: any) => {
			// Clean up the server and show extra information
			deleteFile(serverConfig, tempName, (response) => {
				console.info('Deployment optimization of ' + modelName + ' complete');
				console.info(JSON.stringify(extraInfo, null, 2));
				console.info('Total operating cost per year: ' + extraInfo.total_cost * 24 * 356);
				underProcessing.splice(underProcessing.indexOf(modelPath));
			});
		}).catch((reason) => {
			// Print the reason if a request fails or an error occurs
			printReason(reason);
			underProcessing.splice(underProcessing.indexOf(modelPath));
		});
	});
	context.subscriptions.push(optimize);
}

/**
 * An exported function for deactivating the decomposition plugin
 */
export function deactivate() {}

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
 * Upload a file to the server
 */
function uploadFile(serverConfig: any, uploadPath: string, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const formData = new FormData();
	formData.append('file', fs.createReadStream(uploadPath));
	const request = http.request(
		{
			host: serverConfig.domainName,
			port: serverConfig.publicPort,
			path: '/files/' + fileName,
			method: 'POST',
			headers: formData.getHeaders()
		},
		callback
	);
	formData.pipe(request);
}

/**
 * Download a file from the server
 */
function downloadFile(serverConfig: any, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: serverConfig.domainName,
			port: serverConfig.publicPort,
			path: '/files/' + fileName,
			method: 'GET',
			headers: {
				'Content-Length': 0
			}
		},
		callback
	);
	request.end();
}

/**
 * Delete a file in the server
 */
function deleteFile(serverConfig: any, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: serverConfig.domainName,
			port: serverConfig.publicPort,
			path: '/files/' + fileName,
			method: 'DELETE',
			headers: {
				'Content-Length': 0
			}
		},
		callback
	);
	request.end();
}

/**
 * Decompose the architecture of a RADON model
 */
function decomposeModel(serverConfig: any, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: serverConfig.domainName,
			port: serverConfig.publicPort,
			path: '/dec-tool/decompose?filename=' + fileName,
			method: 'PATCH',
			headers: {
				'Content-Length': 0
			}
		},
		callback
	);
	request.end();
}

/**
 * Optimize the deployment of a RADON model
 */
function optimizeModel(serverConfig: any, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: serverConfig.domainName,
			port: serverConfig.publicPort,
			path: '/dec-tool/optimize?filename=' + fileName,
			method: 'PATCH',
			headers: {
				'Content-Length': 0
			}
		},
		callback
	);
	request.end();
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
 * Print the reason of a promise rejection
 */
function printReason(reason: any) {
	if (reason instanceof http.IncomingMessage) {
		let text = '';
		reason.on('data', (chunk) => {
			text += chunk;
		});
		reason.on('end', () => {
			console.error(JSON.stringify(JSON.parse(text), null, 2));
		});
	} else {
		console.error(reason.message);
	}
}
