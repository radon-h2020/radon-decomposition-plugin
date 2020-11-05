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

const SERVER_DOMAIN_NAME = 'ec2-108-128-104-167.eu-west-1.compute.amazonaws.com';
const SERVER_PUBLIC_PORT = '9000';

/**
 * An exported function for activating the decomposition plugin
 */
export function activate(context: vscode.ExtensionContext) {

	console.info('The RADON decomposition plugin is now active!');

	// Register the 'decompose' command
	let decompose = vscode.commands.registerCommand('radon-dec-plugin.decompose', (uri: vscode.Uri) => {
		const modelPath = uri.path;
		const modelName = path.basename(modelPath);
		console.info('Start architecture decomposition of ' + modelName);

		const tempName = generateTempName(modelName);
		new Promise((resolve, reject) => {
			// Upload the original model to the server
			uploadFile(modelPath, tempName, (response) => {
				if (response.statusCode === 200) {
					console.info('Successfully uploaded the original model to the server');
					resolve({});
				} else {
					console.error('Failed to upload the original model to the server');
					reject(response);
				}
			});
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Decompose the architecture of the model
				decomposeModel(tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully decomposed the architecture of the model');
						resolve(extraInfo);
					} else {
						console.error('Failed to decompose the architecture of the model');
						reject(response);
					}
				});
			});
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Download the resultant model from the server
				downloadFile(tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully downloaded the resultant model from the server');
						response.pipe(fs.createWriteStream(modelPath));
						resolve(extraInfo);
					} else {
						console.error('Failed to download the resultant model from the server');
						reject(response);
					}
				});
			});
		}).then((extraInfo) => {
			// Clean up the server and show extra information
			deleteFile(tempName, (response) => {
				console.info('Architecture decomposition of ' + modelName + ' complete');
				console.info(JSON.stringify(extraInfo, null, 2));
			});
		}).catch((reason) => {
			// Print the reason if a request fails or an error occurs
			printReason(reason);
		});
	});
	context.subscriptions.push(decompose);

	// Register the 'optimize' command
	let optimize = vscode.commands.registerCommand('radon-dec-plugin.optimize', (uri: vscode.Uri) => {
		const modelPath = uri.path;
		const modelName = path.basename(modelPath);
		console.info('Start deployment optimization of ' + modelName);

		const tempName = generateTempName(modelName);
		new Promise((resolve, reject) => {
			// Upload the original model to the server
			uploadFile(modelPath, tempName, (response) => {
				if (response.statusCode === 200) {
					console.info('Successfully uploaded the original model to the server');
					resolve({});
				} else {
					console.error('Failed to upload the original model to the server');
					reject(response);
				}
			});
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Optimize the deployment of the model
				optimizeModel(tempName, (response) => {
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
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Download the resultant model from the server
				downloadFile(tempName, (response) => {
					if (response.statusCode === 200) {
						console.info('Successfully downloaded the resultant model from the server');
						response.pipe(fs.createWriteStream(modelPath));
						resolve(extraInfo);
					} else {
						console.error('Failed to download the resultant model from the server');
						reject(response);
					}
				});
			});
		}).then((extraInfo) => {
			// Clean up the server and show extra information
			deleteFile(tempName, (response) => {
				console.info('Deployment optimization of ' + modelName + ' complete');
				console.info(JSON.stringify(extraInfo, null, 2));
			});
		}).catch((reason) => {
			// Print the reason if a request fails or an error occurs
			printReason(reason);
		});
	});
	context.subscriptions.push(optimize);
}

/**
 * An exported function for deactivating the decomposition plugin
 */
export function deactivate() {}

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
function uploadFile(uploadPath: string, fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const formData = new FormData();
	formData.append('file', fs.createReadStream(uploadPath));
	const request = http.request(
		{
			host: SERVER_DOMAIN_NAME,
			port: SERVER_PUBLIC_PORT,
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
function downloadFile(fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: SERVER_DOMAIN_NAME,
			port: SERVER_PUBLIC_PORT,
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
function deleteFile(fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: SERVER_DOMAIN_NAME,
			port: SERVER_PUBLIC_PORT,
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
function decomposeModel(fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: SERVER_DOMAIN_NAME,
			port: SERVER_PUBLIC_PORT,
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
function optimizeModel(fileName: string, callback?: (res: http.IncomingMessage) => void) {
	const request = http.request(
		{
			host: SERVER_DOMAIN_NAME,
			port: SERVER_PUBLIC_PORT,
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
