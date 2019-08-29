#!/bin/bash

if [[ "$OSTYPE" == "darwin"* ]]; then
	exec >/dev/null 2>&1 # stop stdout and stderr
	cd $( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd ) # change to the location of the executable source
	npm start & # start the application and run terminal in background
	osascript -e 'tell application "Terminal" to close first window' & exit # close the terminal
fi

# Windows OS type could be msys, cygwin, win32, win64, etc...