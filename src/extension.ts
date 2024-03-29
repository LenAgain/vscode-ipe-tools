import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';


const logger = vscode.window.createOutputChannel('Ipe Tools', { log: true });

const IPE_FILE_EXTENSION = 'ipe';


function launchIpe(path: vscode.Uri) {

	const config = vscode.workspace.getConfiguration('ipe-tools');
	const executable = config.get('executable', 'ipe');

	logger.info('Spawning Ipe process:', executable, path.fsPath);
	const child = spawn(executable, [path.fsPath]);

	child.on('error', (error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') {
			logger.error("Can't find specified Ipe executable:", executable);

			vscode.window.showErrorMessage("Can't find the specified Ipe executable. Check that it's in your PATH or that the provided path is correct.");
		} else {
			logger.error('Unexpected Ipe error:', error);

			vscode.window.showErrorMessage("Unexpected Ipe error, check the output panel for more details.");
		}
	});

	child.on('exit', code => {
		logger.info('Ipe exited with code', code);
	});
}

// Check if a figure already exists
// If it does, ask the user whether to overwrite or not
// Return yes/no boolean or undefined if the user cancelled the prompt
async function checkFileExists(figurePath: vscode.Uri, figureName: string): Promise<boolean | undefined> {

	try {
		await vscode.workspace.fs.stat(figurePath);

		logger.debug('Figure with same name already exists, asking for permission to overwrite');

		const answer = await vscode.window.showWarningMessage(
			`${figureName} already exists, do you want to overwrite it?`,
			{ modal: true },
			'Yes',
			'No',
		);

		if (answer === undefined) {
			logger.debug('User cancelled overwrite prompt');
			return undefined;
		}
		if (answer === 'Yes') {
			logger.debug('User gave permission to overwrite');
			return true;
		}

	} catch (error) {
		if (!(error instanceof vscode.FileSystemError)) {
			throw error;
		}
	}
	return false;
}


async function getFigurePath(document: vscode.TextDocument, figureName: string): Promise<vscode.Uri> {
	const config = vscode.workspace.getConfiguration('ipe-tools', document);

	const figureDir = vscode.Uri.file(
		path.join(
			path.dirname(document.fileName),
			config.get('figureDirectory', 'figures'),
		)
	);

	// Check if the figure directory actually exists
	try {
		await vscode.workspace.fs.stat(figureDir);
	} catch (error) {
		if (error instanceof vscode.FileSystemError) {
			await vscode.workspace.fs.createDirectory(figureDir);
		} else {
			throw error;
		}
	}

	return vscode.Uri.joinPath(figureDir, `${figureName}.${IPE_FILE_EXTENSION}`);
}


async function insertFigure() {

	const editor = vscode.window.activeTextEditor;

	if (editor === undefined) {
		return;
	}

	const figureName = await vscode.window.showInputBox({
		placeHolder: 'Figure name',
		prompt: 'Enter the name of the new Ipe figure'
	});

	// User cancelled the input box, quit
	if (figureName === undefined) {
		return;
	}

	const config = vscode.workspace.getConfiguration('ipe-tools');

	let snippetText: string | string[] = config.get('ipeSnippet', []);

	if (Array.isArray(snippetText)) {
		const eol = editor.document.eol === 1 ? '\n' : '\r\n';
		snippetText = snippetText.join(eol);
	}

	const cursorPosition = editor.selection.active;

	const snippetEdit = vscode.SnippetTextEdit.insert(
		cursorPosition,
		new vscode.SnippetString(snippetText.replace('%f', figureName))
	);

	const workspaceEdit = new vscode.WorkspaceEdit();
	workspaceEdit.set(editor.document.uri, [snippetEdit]);

	const figurePath = await getFigurePath(editor.document, figureName);

	const overwrite = await checkFileExists(figurePath, figureName);

	// User cancelled overwrite prompt
	if (overwrite === undefined) {
		return;
	}

	// If the file exists and the user says we can overwrite,
	// delete it so Ipe can create a new one
	if (overwrite) {
		workspaceEdit.deleteFile(figurePath);
	}

	// Otherwise it either doesn't exist or it does but we want to change it,
	// let Ipe handle it

	vscode.workspace.applyEdit(workspaceEdit);

	launchIpe(figurePath);
}


function getFileDialogUri() {
	// What dir to launch the file dialog from - current file dir otherwise home dir
	const documentUri = vscode.window.activeTextEditor?.document.fileName;

	if (documentUri !== undefined) {
		return vscode.Uri.file(path.dirname(documentUri));
	} else {
		return vscode.Uri.file(os.homedir());
	}
}


async function newFigure() {

	logger.debug('Prompting for a save location');

	const path = await vscode.window.showSaveDialog({
		defaultUri: getFileDialogUri(),
		filters: { Ipe: ['ipe', 'pdf'] },
		title: 'Create Ipe figure',
		saveLabel: 'Create Figure',
	});

	if (path === undefined) {
		logger.debug('No save location picked, exiting');
		return;
	}

	launchIpe(path);
}


async function editFigure(figurePath?: vscode.Uri) {

	logger.info('Editing figure');

	if (figurePath !== undefined) {
		logger.debug('Using figure path passed as parameter:', figurePath.fsPath);

		launchIpe(figurePath);
		return;
	}

	const editor = vscode.window.activeTextEditor;

	if (editor === undefined) {
		return;
	}

	// If we have a selection then launch Ipe with that figure name
	if (!editor.selection.isEmpty) {
		logger.debug('Using figure name from selected text in document');

		const figureName = editor.document.getText(editor.selection);

		const figurePath = await getFigurePath(editor.document, figureName);

		launchIpe(figurePath);
		return;
	}

	// We don't have a selection so try to find a figure name on the current line with regex

	const config = vscode.workspace.getConfiguration('ipe-tools');
	const figureRegex: RegExp = config.get('figureRegex', RegExp(''));

	const line = editor.document.lineAt(editor.selection.active).text;

	const match = line.match(figureRegex);

	if (match) {
		const figureName = match.groups?.figureName;

		if (figureName) {
			logger.debug('Using figure name from regex match on current line:', figureName);

			const figurePath = await getFigurePath(editor.document, figureName);

			launchIpe(figurePath);
			return;
		}
	}

	logger.debug('No figure matched on current line, launching file dialog');

	const paths = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		defaultUri: getFileDialogUri(),
		filters: { 'Ipe': ['ipe', 'pdf'] },
		title: 'Open Ipe Figure',
		openLabel: 'Open Figure',
	});

	if (paths === undefined) {
		logger.debug('No file picked, aborting');
		return;
	}
	figurePath = paths[0];

	logger.debug('User picked file:', figurePath.fsPath);
	launchIpe(figurePath);
}


const SUPPORTED_MIME_TYPES = [
	'application/pdf',
	'image/jpeg',
	'image/png',
];


async function createMediaEdit(
	document: vscode.TextDocument,
	dataTransfer: vscode.DataTransfer,
): Promise<{ insertText: vscode.SnippetString, additionalEdit: vscode.WorkspaceEdit } | undefined> {

	for (const [mime, item] of dataTransfer) {

		if (!SUPPORTED_MIME_TYPES.includes(mime)) {
			logger.debug('Skipping unsupported MIME type:', mime);
			continue;
		}

		const file = item.asFile();

		if (file === undefined) {
			logger.debug('Cannot resolve data item as file, aborting');
			return;
		}

		const parsedFileName = path.parse(file.name);

		let figureName = await vscode.window.showInputBox({
			prompt: 'Enter the name of the image to insert',
			value: parsedFileName.name,
		});

		if (figureName === undefined) {
			logger.debug('User cancelled figure name prompt, aborting');
			return;
		}

		logger.debug('User entered figure name:', figureName);

		const config = vscode.workspace.getConfiguration('ipe-tools', document);

		const figurePath = vscode.Uri.file(path.join(
			path.dirname(document.fileName),
			config.get('figureDirectory', ''),
			figureName + parsedFileName.ext,
		));

		logger.debug('Using figure path:', figurePath);

		const overwrite = await checkFileExists(figurePath, figureName);

		if (overwrite === undefined) {
			return;
		}

		// Create additional edit to save the file in the figures directory
		const workspaceEdit = new vscode.WorkspaceEdit();

		const contents = await file.data();

		workspaceEdit.createFile(figurePath, { contents: contents, overwrite: overwrite });

		// Now the actual pase edit to insert the LaTeX code
		const insertText = config.get('externalSnippet', '').replace('%f', figureName);

		return {
			insertText: new vscode.SnippetString(insertText),
			additionalEdit: workspaceEdit,
		};
	}
}


class ImageDropProvider implements vscode.DocumentDropEditProvider {

	async provideDocumentDropEdits(
		document: vscode.TextDocument,
		position: vscode.Position,
		dataTransfer: vscode.DataTransfer,
		token: vscode.CancellationToken
	): Promise<vscode.DocumentDropEdit | undefined> {

		const result = await createMediaEdit(document, dataTransfer);

		if (result === undefined) {
			return;
		}

		const { insertText, additionalEdit } = result;

		const dropEdit = new vscode.DocumentDropEdit(insertText);
		dropEdit.additionalEdit = additionalEdit;

		return dropEdit;
	}
}


class ImagePasteProvider implements vscode.DocumentPasteEditProvider {

	async provideDocumentPasteEdits(
		document: vscode.TextDocument,
		ranges: readonly vscode.Range[],
		dataTransfer: vscode.DataTransfer,
		token: vscode.CancellationToken
	): Promise<vscode.DocumentPasteEdit | undefined> {

		const result = await createMediaEdit(document, dataTransfer);

		if (result === undefined) {
			return;
		}

		const { insertText, additionalEdit } = result;

		const pasteEdit = new vscode.DocumentPasteEdit(insertText, 'Insert external figure');
		pasteEdit.additionalEdit = additionalEdit;

		return pasteEdit;
	}
}


export function activate(context: vscode.ExtensionContext) {

	logger.info('Extension activated');

	const latexSelector = { scheme: 'file', language: 'latex' };

	// For some reason defining the supported mime types means the provider isn't called, as of 11/10/23
	const pasteMetadata = { id: 'paste-figure', pasteMimeTypes: ['*/*'] };

	context.subscriptions.push(
		vscode.commands.registerCommand(`ipe-tools.insertFigure`, insertFigure),
		vscode.commands.registerCommand(`ipe-tools.newFigure`, newFigure),
		vscode.commands.registerCommand(`ipe-tools.editFigure`, editFigure),
		vscode.languages.registerDocumentDropEditProvider(latexSelector, new ImageDropProvider()),
		vscode.languages.registerDocumentPasteEditProvider(latexSelector, new ImagePasteProvider(), pasteMetadata)
	);
}
