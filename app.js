// This is the server file

const {app, BrowserWindow, ipcMain, dialog} = require("electron");
const shell = require("shelljs");
shell.config.execPath = shell.which("node").toString();
const fs = require("fs");


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let window;

function createWindow() {
  // Create the browser window.
  window = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    nodeIntegration: false, // will be set to false by default starting with Electron 5.0.0
    contextIsolation: false // disable if dealing with only local application files, no remote security threats

  });
  // and load the index.html of the app.
  window.loadURL(`file://${__dirname}/app/index.html`)

  // Emitted when the window is closed.
  window.on("closed", () => {
    // Dereference the window object.
    window = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if(process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if(window === null) {
    createWindow();
  }
});

// Save a task list to the disk.
ipcMain.on("save", (event, tasks) => {
  dialog.showSaveDialog({defaultPath: "./tasks"}, (filepath) => {
    if(filepath === undefined) {
      console.warn("No save file selected.");
      event.sender.send("save-canceled");
      return;
    }
    if(tasks == null || tasks == "") {
      console.warn("You cannot save an empty tasks file.");
      event.sender.send("save-canceled");
      return;
    }
    fs.writeFile(filepath, JSON.stringify(tasks, null, 4), (err) => {
      if(err) {
        console.error(err);
        return;
      }
      event.sender.send("save-done");
    });
  });
});


ipcMain.on("load", (event) => {
  dialog.showOpenDialog({
    defaultPath: "./tasks",
    filters: [{name: 'Tasks', extensions: ['json']}]}, (filepath) => {
    if(filepath === undefined)
    {
      console.warn("No load file selected.");
      event.sender.send("load-canceled");
      return;
    }
    if(filepath == null || filepath == "")
    {
      console.warn("Task file is empty.");
      return;
    }
    fs.readFile(filepath[0], (err, data) =>
    {
      if(err)
      {
        console.error(err);
        event.sender.send("load-canceled");
        return;
      }
      event.sender.send("load-done", JSON.parse(data));
    });
  });
});


ipcMain.on("run-task", (event, taskStr) => {
  if (!shell.which('node')) {
    shell.echo("Sorry, running a task requires \'node\'.");
    shell.exit(1);
  }
  console.log(taskStr);
  console.log(shell.exec(taskStr).stdout);
  event.sender.send("run-task-done");
});
