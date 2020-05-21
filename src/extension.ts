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

/**
 * An exported function for activating the decomposition plugin
 */
export function activate(context: vscode.ExtensionContext) {

	console.info('The RADON decomposition plugin is now active!');

	const SERVER_DOMAIN_NAME = 'ec2-108-128-104-167.eu-west-1.compute.amazonaws.com';
	const SERVER_PUBLIC_PORT = '9000';

	// Register the 'optimize' command
	let optimize = vscode.commands.registerCommand('radon-dec-plugin.optimize', (uri: vscode.Uri) => {
		const filePath = uri.path;
		const fileName = path.basename(filePath);
		console.info('Start deployment optimization of ' + fileName);

		const extName = path.extname(fileName);
		const baseName = path.basename(fileName, extName);
		const tempName = baseName + '_' + uuid.v4() + extName;
		new Promise((resolve, reject) => {
			// Upload the original model to the server
			const formData = new FormData();
			formData.append('file', fs.createReadStream(filePath));
			const request = http.request(
				{
					host: SERVER_DOMAIN_NAME,
					port: SERVER_PUBLIC_PORT,
					path: '/files/' + tempName,
					method: 'POST',
					headers: formData.getHeaders()
				},
				(response) => {
					if (response.statusCode === 200) {
						console.info('Successfully uploaded the original model to the server');
						resolve({});
					} else {
						console.error('Failed to upload the original model to the server');
						reject(response);
					}
				}
			);
			formData.pipe(request);
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Optimize the deployment of the model
				const request = http.request(
					{
						host: SERVER_DOMAIN_NAME,
						port: SERVER_PUBLIC_PORT,
						path: '/dec-tool/optimize?filename=' + tempName,
						method: 'PATCH',
						headers: {
							'Content-Length': 0
						}
					},
					(response) => {
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
					}
				);
				request.end();
			});
		}).then((extraInfo) => {
			return new Promise((resolve, reject) => {
				// Download the resultant model from the server
				const request = http.request(
					{
						host: SERVER_DOMAIN_NAME,
						port: SERVER_PUBLIC_PORT,
						path: '/files/' + tempName,
						method: 'GET',
						headers: {
							'Content-Length': 0
						}
					},
					(response) => {
						if (response.statusCode === 200) {
							console.info('Successfully downloaded the resultant model from the server');
							response.pipe(fs.createWriteStream(filePath));
							resolve(extraInfo);
						} else {
							console.error('Failed to download the resultant model from the server');
							reject(response);
						}
					}
				);
				request.end();
			});
		}).then((extraInfo) => {
			// Clean up the server and show extra information
			const request = http.request(
				{
					host: SERVER_DOMAIN_NAME,
					port: SERVER_PUBLIC_PORT,
					path: '/files/' + tempName,
					method: 'DELETE',
					headers: {
						'Content-Length': 0
					}
				},
				(response) => {}
			);
			request.end();
			console.info('Deployment optimization of ' + fileName + ' complete');
			console.info(JSON.stringify(extraInfo, null, 2));
		}).catch((reason) => {
			if (reason instanceof http.IncomingMessage) {
				// Print the response if a request failed
				let text = '';
				reason.on('data', (chunk) => {
					text += chunk;
				});
				reason.on('end', () => {
					console.error(JSON.stringify(JSON.parse(text), null, 2));
				});
			} else {
				// Print the message if an error occurred
				console.error(reason.message);
			}
		});
	});
	context.subscriptions.push(optimize);
}

/**
 * An exported function for deactivating the decomposition plugin
 */
export function deactivate() {}
