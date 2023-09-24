# Ipe Tools

A small Visual Studio Code extension for integrating the Ipe extensible drawing editor. This extension is intended for my personal use.

## Usage

The extension provides three commands.

### `ipe-tools.insertFigure`

Inserts a snippet and launches Ipe to edit a new figure.

If the editor has a selection, the first selection is used as the figure name, otherwise the editor prompts for a name.
The snippet specified in `ipe-tools.snippet` is then inserted which expands around the current selection.

### `ipe-tools.newFigure`

Creates a new figure using the default save dialog. Note that the figure isn't actually saved until it's saved from Ipe.

### `ipe-tools.editFigure`

Allows launching Ipe to edit a figure directly from VS Code. This command is integrated into the file explorer context menu.
