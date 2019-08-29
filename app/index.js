// This is the client file

const { ipcRenderer } = require("electron");

// Create a list of placeholder tasks.
let tasks;

// Generates a command string from a task object.
function generateCommand(task) {
  let commandString = "node boardcmd.js ";
  commandString += task.command + " ";

  if("device_class" in task) commandString += "\"" + task.device_class + "\" ";
  
  commandString += "\"" + task.project + "\" ";

  if("scenario" in task) commandString += "-s \"" + task.scenario + "\" ";
  if("program" in task) commandString += "-p \"" + task.program + "\" ";
  if("device_name" in task) commandString += "-e \"" + task.device_name + "\" ";

  return commandString;
}

// Refresh the tasks list.
function refreshTasks() {
  // Remove the current task nodes, if any exist.
  let taskNodes = document.getElementsByClassName("task");
  let totalTaskNodes = taskNodes.length;
  for(var i = 0; i < totalTaskNodes; i++) taskNodes[0].remove();

  // Create nodes for each task in the list.
  tasks.forEach((e, i) => {
    // Surrounding div element.
    var node = document.createElement("div");
    node.className = "row task";

    // Paragraph element that shows the task's full command.
    var para = document.createElement("p");
    para.innerText = generateCommand(e);    
    node.appendChild(para);

    var buttonDiv = document.createElement("div");
    buttonDiv.className = "buttons";
    
    // Edit button.
    var editButton = document.createElement("img");
    editButton.className = "edit-task";
    editButton.src = "../.images/edit_task.png";
    editButton.onclick = () => editTask(i);
    buttonDiv.appendChild(editButton);

    // Delete button.
    var deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.innerHTML = "&times;";
    deleteButton.onclick = () => confirmDelete(i);
    buttonDiv.appendChild(deleteButton);

    node.appendChild(buttonDiv);
    
    document.getElementById("table-view").appendChild(node);
  });
}

// Utility function to show or hide an element by ID.
function setDisplay(id, shouldDisplay) {
  let elem = document.getElementById(id);
  if(shouldDisplay) elem.style.display = "";
  else elem.style.display = "none";
}

// Currently active view.
var active_view = "table-view";

// Change the current view.
function changeView(new_view) {
  if(new_view == active_view) return;
  setDisplay(active_view, false);
  setDisplay(new_view, true);
  active_view = new_view;
}

// Set up button to close a view.
var buttons = document.getElementsByClassName("close-view");
for(var i = 0; i < buttons.length; i++) {
  // Set onclick to change the view back to the default (table-view).
  buttons[i].onclick = () => changeView("table-view");
}

// This defines the task edit button functionality.
// This sets up and then switches to the edit view for a task.
function editTask(i) {
  // Current task.
  var e = tasks[i];
  // Reset the form.
  document.getElementById("task-form").reset();
  // Set ID on the form. This is needed in the update function.
  document.getElementById("task-id").value = i;

  // Set task property fields.
  document.getElementById("task-command").value = e.command;
  document.getElementById("task-device-class").value = e.device_class;
  document.getElementById("task-project-text").value = e.project;
  document.getElementById("task-scenario-text").value = e.scenario || "";
  document.getElementById("task-program-text").value = e.program || "";
  document.getElementById("task-device-name").value = e.device_name || "";

  // Hide all the file pickers.
  let taskFileTexts = document.getElementsByClassName("task-file-text");
  let taskFileButtons = document.getElementsByClassName("task-edit-file");
  let taskFilePickers = document.getElementsByClassName("task-file-picker");
  for(let j = 0; j < taskFileTexts.length; j++) {
    taskFileTexts[j].style.display = "";
    taskFileButtons[j].style.display = "";
    taskFilePickers[j].style.display = "none";
  }

  // Finally, change the view to the task editor.
  changeView("edit-view");
}

// The edit button function for file picker fields on the edit view.
// Hides the text box and button and shows the file picker.
function showTaskFilePicker(name) {
  setDisplay(name + "-text", false);
  setDisplay(name + "-btn", false);
  setDisplay(name, true);
}

// Submit updates for task parameters.
function updateTask() {
  // Get the task from the list by its ID/index.
  let index = document.getElementById("task-id").value;
  let task = tasks[index];

  // Update the simple values for the task.
  task.command = document.getElementById("task-command").value;
  task.device_class = document.getElementById("task-device-class").value;

  // Set the device name if it was present.
  let deviceNameField = document.getElementById("task-device-name");
  if(deviceNameField.value) task.device_name = deviceNameField.value;

  // Update the file picker values if they have been changed.
  let taskProjectPicker = document.getElementById("task-project");
  let taskScenarioPicker = document.getElementById("task-scenario");
  let taskProgramPicker = document.getElementById("task-program");

  if(taskProjectPicker.files[0])
    task.project = taskProjectPicker.files[0].path;
  if(taskScenarioPicker.files[0])
    task.scenario = taskScenarioPicker.files[0].path;
  if(taskProgramPicker.files[0])
    task.program = taskProgramPicker.files[0].path;

  // Refresh the task list to reflect updated information.
  refreshTasks();
  // Finally, change the view to the main table view.
  changeView("table-view");
}

// The new button creates a new task and opens it up in the edit view.
function newTask() {
  let task = { // add a new task with these default values.
    command: "all",
    device_class: "",
    project: ""
  };

  if(tasks === undefined) { // tasks is "undefined" if there are no tasks loaded
    tasks = []; // create an empty array for "tasks"
  }

  if(tasks.push(task)) { // if new default task is pushed/added successfully
    setDisplay("no-tasks-loaded", false);
  };

  // Refresh the task list to show the new task.
  refreshTasks();
}

// Show a confirmation box before deleting a task.
function confirmDelete(i) {
  // Set the function for the delete button to delete the correct row.
  let deleteButton = document.getElementById("dialog-delete-button");
  deleteButton.onclick = () => deleteTask(i);
  // Show the dialog box.
  setDisplay("confirm-dialog", true);
}

// Cancel the dialog box by closing it.
function cancelDialog() {
  setDisplay("confirm-dialog", false);
}

// Delete a task from the list.
function deleteTask(i) {
  tasks.splice(i, 1);
  // Hide the dialog box.
  setDisplay("confirm-dialog", false);
  // Refresh the tasks list.
  refreshTasks();
}

// Tell Electron to save the task list to a file.
function saveTasks() {
  // Show the loading dialog while file is being saved.
  setDisplay("loading-dialog", true);
  // Send the task list to the main process and tell it to save them to a file.
  ipcRenderer.send("save", tasks);
}

function loadTasks() {
  // Show the loading dialog while file is being loaded.
  setDisplay("loading-dialog", true);
  // Ask the main process to load the tasks from a file.
  ipcRenderer.send("load");
}
// loadTasks(); // Go ahead and load up the tasks list.


Date.prototype.mmddyyyy = function() {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return  [(mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd,
          this.getFullYear()].join('');
};

function getBuildNumber() {
  var date = new Date();
  return date.mmddyyyy();
}


// Hide the loading dialog box after file is finished saving.
ipcRenderer.on("save-done", (_) => {
  setDisplay("loading-dialog", false);
});
ipcRenderer.on("save-canceled", (_) => {
  setDisplay("loading-dialog", false);
});


// Set tasks after the load is done then hide the dialog box.
ipcRenderer.on("load-done", (_, data) => {
  // Set tasks to the received data.
  tasks = data;
  // Refresh the task list.
  refreshTasks();
  // Hide the loading dialog box.
  setDisplay("loading-dialog", false);
  setDisplay("no-tasks-loaded", false);
});
ipcRenderer.on("load-canceled", (_) => {
  setDisplay("loading-dialog", false);
});
