#!/bin/bash

UUID="clock@devilbd.com"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing extension $UUID..."

# Create the extensions directory if it doesn't exist
mkdir -p "$EXT_DIR"

# Copy all essential files to the target directory
cp -r extension.js metadata.json stylesheet.css prefs.js prefs.ui "$EXT_DIR/"
mkdir -p "$EXT_DIR/schemas"
cp schemas/*.gschema.xml "$EXT_DIR/schemas/"

# Compile the schemas in the target directory
glib-compile-schemas "$EXT_DIR/schemas/"

echo "Files copied and schemas compiled successfully to $EXT_DIR"

# Try to enable the extension
gnome-extensions enable "$UUID"

echo "Extension enabled!"
echo ""
echo "NOTE: If you are on Wayland (default on Fedora 43 / GNOME 49), you need to log out and log back in for the changes to take effect."
echo "If you are using X11, press Alt+F2, type 'r', and press Enter to restart the GNOME Shell."
