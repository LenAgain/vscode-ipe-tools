import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';


const logger = vscode.window.createOutputChannel('Ipe Tools', { log: true });


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


async function insertFigure() {

	// This cannot be undefined as the command is only enabled with editorTextFocus
	const editor = vscode.window.activeTextEditor!;
	let figureName: string;

	if (editor.selection.isEmpty) {
		logger.debug('No editor selection, prompting for figure name');

		const name = await vscode.window.showInputBox({
			placeHolder: 'Figure name',
			prompt: 'Enter the name of the new Ipe figure'
		});

		if (name === undefined) {
			return;
		}
		figureName = name;

		logger.debug('Inserting figure name at cursor position:', figureName);

		const cursorPosition = editor.selection.active;
		editor.edit(editBuilder => editBuilder.insert(cursorPosition, figureName));

		logger.debug('Selecting figure name in editor');

		editor.selections = [new vscode.Selection(cursorPosition, cursorPosition.translate(0, figureName.length))];
	} else {
		figureName = editor.document.getText(editor.selection);
		logger.debug('Using figure name from highlighted text in document:', figureName);
	}

	const config = vscode.workspace.getConfiguration('ipe-tools');

	let snippet: string | string[] = config.get('snippet', []);

	if (Array.isArray(snippet)) {
		const eol = editor.document.eol === 1 ? '\n' : '\r\n';
		snippet = snippet.join(eol);
	}

	vscode.commands.executeCommand('editor.action.insertSnippet', { snippet: snippet });

	const figureDir = path.join(path.dirname(editor.document.fileName), config.get('figurePath', 'figures'));
	const figureDirUri = vscode.Uri.file(figureDir);

	try {
		logger.debug('Checking if figure directory exits:', figureDir);
		await vscode.workspace.fs.stat(figureDirUri);
	} catch {
		logger.debug('Figure directory does not exist, creating path:', figureDir);
		await vscode.workspace.fs.createDirectory(figureDirUri);
	}

	const fileExtension = config.get('figureFileExtension', 'ipe');

	const figurePath = path.join(figureDir, `${figureName}.${fileExtension}`);
	logger.debug('Using figure path', figurePath);

	launchIpe(vscode.Uri.file(figurePath));
}


function getFileDialogUri() {
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
		logger.debug('Using path passed as parameter:', figurePath.fsPath);

		launchIpe(figurePath);
		return;
	}

	const config = vscode.workspace.getConfiguration('ipe-tools');

	const editor = vscode.window.activeTextEditor!;

	if (!editor.selection.isEmpty) {
		logger.debug('Using figure name from selected text in document');
		const figureName = editor.document.getText(editor.selection);

		const documentDir = path.dirname(editor.document.fileName);
		const figureDirName = config.get('figurePath', 'figures');
		const figureFileExtension = config.get('figureFileExtension', 'ipe');

		figurePath = vscode.Uri.file(path.join(documentDir, figureDirName, `${figureName}.${figureFileExtension}`));
		logger.debug('Using figure path:', figurePath.fsPath);

		launchIpe(figurePath);
		return;
	}

	const figureRegex: RegExp = config.get('figureRegex', RegExp(''));

	const line = editor.document.lineAt(editor.selection.active).text;

	const match = line.match(figureRegex);

	if (match) {
		logger.debug('Regex match, using figure name from current line in document');

		const figureName = match.groups?.figureName;

		if (figureName) {
			logger.debug('Found figure name from regex:', figureName);

			const documentDir = path.dirname(editor.document.fileName);
			const figureDirName = config.get('figurePath', 'figures');
			const figureFileExtension = config.get('figureFileExtension', 'ipe');

			figurePath = vscode.Uri.file(path.join(documentDir, figureDirName, `${figureName}.${figureFileExtension}`));
			logger.debug('Using figure path:', figurePath.fsPath);

			launchIpe(figurePath);
			return;
		}
		logger.debug('No figure name found from regex match, continuing');
	}

	logger.debug('No URI provided, prompting user');

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
		logger.debug('No file picked, exiting');
		return;
	}
	figurePath = paths[0];

	logger.debug('User picked file:', figurePath.fsPath);
	launchIpe(figurePath);
}


export function activate(context: vscode.ExtensionContext) {

	logger.info('Extension activated');

	context.subscriptions.push(
		vscode.commands.registerCommand(`ipe-tools.insertFigure`, insertFigure),
		vscode.commands.registerCommand(`ipe-tools.newFigure`, newFigure),
		vscode.commands.registerCommand(`ipe-tools.editFigure`, editFigure),
	);
}
