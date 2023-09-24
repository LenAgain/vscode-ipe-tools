# Ipe Tools

A small Visual Studio Code extension for integrating the Ipe extensible drawing editor. This extension is intended for my personal use.

## Usage

The extension provides three commands.

### `ipe-tools.insertFigure`

The command flow is roughly as follows:
- Determine the figure name
- Insert the snippet
- Create the figure directory if necessary
- Launch Ipe to edit the figure

If the editor has a selection, the first selection is used as the figure name, otherwise the editor prompts for a name.
The snippet specified in `ipe-tools.snippet` is then inserted.

### `ipe-tools.newFigure`

Creates a new figure using the default save dialog. Note that the figure isn't actually saved until it's saved from Ipe.

### `ipe-tools.editFigure`

Allows launching Ipe to edit a figure directly from VS Code. This command is integrated into the file explorer context menu.
