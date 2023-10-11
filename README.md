# Ipe Tools

A small Visual Studio Code extension for integrating the Ipe extensible drawing editor. This extension is intended for my personal use.

## Commands

The extension provides three commands for managing Ipe figures.

### `ipe-tools.insertFigure`

Inserts a snippet and launches Ipe to edit a new figure.

The user is prompted for a figure name, then the snippet specified in `ipe-tools.snippet` is inserted, with the `%f` placeholder replaced with the figure name, and finally Ipe is launched to edit the figure. Note that due to the way Ipe
behaves with blank files, the file isn't actually saved until the user chooses to from inside Ipe.

### `ipe-tools.newFigure`

Creates a new figure using the default save dialog. Note again that the figure isn't actually saved until it's saved from Ipe.

### `ipe-tools.editFigure`

Allows launching Ipe to edit a figure directly from VS Code. **This command is integrated into the file explorer context menu.**
If the editor has a selection it attempts to find a figure with a name matching the selected text. Otherwise, it attempts
a regex match on the current line based on the pattern specified in `ipe-tools.figureRegex`.
