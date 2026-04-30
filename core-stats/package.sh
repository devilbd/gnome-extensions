#!/bin/bash

# This script packages the extension into a ZIP file for distribution.
# It uses the gnome-extensions pack command.

UUID="core-stats@devilbd.com"
OUTPUT_DIR="."

echo "Packaging extension $UUID..."

# Ensure schemas are compiled
glib-compile-schemas schemas/

# Pack the extension
gnome-extensions pack --force --out-dir="$OUTPUT_DIR"

echo "Extension packaged successfully: $OUTPUT_DIR/$UUID.shell-extension.zip"
