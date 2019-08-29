// This is the server file

const {app, BrowserWindow, ipcMain, dialog} = require("electron");
const fs = require("fs");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let window;

function createWindow() {
  // Create the browser window.
  window = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true
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
  dialog.showSaveDialog({defaultPath: "./tasks.json"}, (filename) => {
    fs.writeFile("./tasks.json", JSON.stringify(tasks, null, 4), (err) => {
      if(err) {
        console.error(err);
        return;
      }
  
      event.sender.send("save-done");
    });
  });
});

ipcMain.on("load", (event) => {
  dialog.showOpenDialog({properties: ['openFile', 'openDirectory'], defaultPath: "./tasks"}, (filepath) => {
    if(filepath === undefined){
        console.error("No file selected.");
        return;
    }
    fs.readFile(filepath[0], (err, data) => {
      if(err) {
        console.error(err);
        return;
      }

      event.sender.send("load-done", JSON.parse(data));
    });
  });
});
