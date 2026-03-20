#!/bin/bash

# This script packages the extension into a ZIP file for distribution.
# It uses the gnome-extensions pack command.

UUID="clock@devilbd.com"
OUTPUT_DIR="."

echo "Packaging extension $UUID..."

# Ensure schemas are compiled (optional, but good practice)
glib-compile-schemas schemas/

# Pack the extension
# --force overwrites the existing zip
# --out-dir specifies where to save the zip
gnome-extensions pack --force --out-dir="$OUTPUT_DIR"

echo "Extension packaged successfully: $OUTPUT_DIR/$UUID.shell-extension.zip"
