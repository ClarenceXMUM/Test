#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
open -a "Google Chrome" --args --app="file://$SCRIPT_DIR/dist/index.html" --window-size=1200,900
