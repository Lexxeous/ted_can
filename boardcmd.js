#!/usr/bin/env node
const shell = require("shelljs");
const fs = require("fs");
const path = require("path");

// Set up command line arguments.
const argv = require("yargs")
  .usage("Usage: $0 <command> [options]")
  .command({
    command: "make [project_directory]",
    alias: "m",
    describe: "build an MPLab project",
    builder: yargs => {
      yargs.positional("project_directory", {
        describe: "directory for MPLab project",
        default: "."
      });
    }
  })
  .command({
    command: "flash <device_type> <hex_file>",
    alias: "f",
    describe: "flash a hex file onto an ECU",
    builder: yargs => {
      yargs
        .positional("device_type", {
          describe: "name of device e.g. dsPIC33EV256GM106"
        })
        .positional("hex_file", {
          describe: "location of .hex file"
        });
    }
  })
  .command({
    command: "all <device_type> [project_directory]",
    alias: "a",
    describe: "build a project and then flash it onto an ECU",
    builder: yargs => {
      yargs
        .positional("device_type", {
          describe: "name of device e.g. dsPIC33EV256GM106"
        })
        .positional("project_directory", {
          describe: "directory for MPLab project"
        });
    }
  })
  .option("s", {
    alias: "scenario",
    describe: "scenario file to be used when building project"
  })
  .option("p", {
    alias: "protocol",
    describe: "name of the protocol file (must be in project dir)"
  })
  .implies("s", "p")
  .option("e", {
    alias: "ecu_name",
    describe: "name of the ECU from the scenario file being programmed"
  })
  .implies("s", "e")
  .option("h", {
    alias: "custom_hex",
    describe: "use with all if hex file is not in <project_dir>/dist/default/production"
  })
  .demandCommand(1).argv;

// Verify that a valid command is used.
if (argv._[0] !== "make" && argv._[0] !== "flash" && argv._[0] !== "all") {
  console.log(argv._[0] + " is not a valid command, try make, flash, or all");
  process.exit(1);
}

// Function that returns the new data for the written file. Separated to allow changes to be made easily.
function getDataToWrite(protocol_file, bytes) {
  // Current method. Replaces a specific set of characters with the new code.
  return protocol_file.replace("// 0000 INSERT MESSAGE 0000 //\r\n", bytes);
}


// Need this to tell if all is called in the flash function.
var hex_file;

// COMMAND: MAKE. Builds an MPLab project. Also runs this if all is the command.
if (argv._[0] === "make" || argv._[0] === "all") {
  // Verify that make is available.
  if (!shell.which("make")) {
    console.log("make is not available.");
  } else {
    // These will be used to rewrite the original protocol file if it is changed.
    var protocol_file, protocol_path;

    // Do this if there is a scenario file to be included.
    if (argv.scenario) {
      // Read in scenario file.
      let data = fs.readFileSync(argv.scenario, { encoding: "utf8" });

      // List of messages to be sent/received by the ECU's.
      var messages = {};

      // Get each line and parse it, separating out the messages for each ECU.
      // TODO: Allow for formats such as DBC
      data.split("\r\n").forEach(function (e) {
        let values = e.split(" ");
        let ecu_name = values[1];
        let send_mode = values[2];
        if (!messages.hasOwnProperty(ecu_name)) {
          messages[ecu_name] = {
            Tx: [],
            Rx: [],
            total: 0
          };
        }
        messages[ecu_name][send_mode].push({
          sequence_number: values[0],
          message_id: values[3],
          data: values.slice(4)
        });
        messages[ecu_name].total++;
      });

      // Go through the ECU's messages and create its edited protocol (.c) file.
      let ecu_name = argv.ecu_name;
      // String containing information to be written to the file.
      var bytes = "struct Message messages[" + messages[ecu_name].total + "] = {\r\n";

      // Format the transmit data to be used in the C file.
      messages[ecu_name].Tx.forEach(m => {
        // Convert the eight data (string) values into four C-compliant hexadecimal values.
        // The final format of this string is `{0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}`.
        let data = "{0x" + m.data.map((e, j, a) => {
          if (j % 2 == 1) return undefined;
          return e + (a[j + 1] || "00");
        }).filter(e => e).join(", 0x") + "}";

        // The comes out to something like `{1, "ECU1", "Tx", 101, {0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}}`.
        bytes += "{" + m.sequence_number + ', "' + ecu_name + '", "Tx", ' + m.message_id + ", " + data + "},\r\n";
      });

      // Format the receive data to be used in the C file.
      messages[ecu_name].Rx.forEach(m => {
        // The comes out to something like `{0, "ECU1", "Rx", 101, {}}`.
        bytes += '{0, "' + ecu_name + '", "Rx", ' + m.message_id + ", {}},\r\n";
      });
      // Finish off the data.
      bytes = bytes.slice(0, -1) + "};\r\n";

      // String that points to protocol file.
      protocol_path = path.resolve(path.join(argv.project_directory, argv.protocol));

      // Open the protocol file specified by the user.
      protocol_file = fs.readFileSync(protocol_path, { encoding: "utf8" });

      // Write the data to the protocol file.
      let full_data = getDataToWrite(protocol_file, bytes);
      fs.writeFileSync(protocol_path, full_data);

      // Go to project directory.
      shell.cd(argv.project_directory);

      // Execute make in the project directory to compile the hex file.
      shell.exec("make");

      // Revert file changes.
      fs.writeFileSync(protocol_path, protocol_file);

      // Update this in case this is the all command.
      if (argv.custom_hex) {
        hex_file = argv.hexfile;
      } else {
        let output_dir = path.join(argv.project_directory, "dist/default/production");
        let hex_file_name = fs.readdirSync(output_dir).find(e => path.extname(e) === ".hex");
        hex_file = path.join(output_dir, hex_file_name);
      }
    }
  }
}

// COMMAND: FLASH. Flash a hex file onto an ECU. Also runs this if all is the command.
if (argv._[0] === "flash" || argv._[0] === "all") {
  // Verify that ipecmd is available.
  if (!shell.which("ipecmd")) {
    console.log("Cannot run this task, ipecmd not available.");
  } else {
    // Adjust device name to fit the ipecmd format.
    let part_name = argv.device_type;
    if (part_name.startsWith("PIC")) part_name = part_name.slice(3);
    else if (part_name.startsWith("dsPIC")) part_name = part_name.slice(5);
    else if (part_name.startsWith("rfPIC")) part_name = part_name.slice(5);

    // Prepare ipecmd.
    let cmd = "ipecmd -TPPKOB -M -OL";
    // Specify part name given by user.
    cmd += " -P" + part_name;
    // Specify hex file from directory structure.
    cmd += " -F" + (hex_file || argv.hex_file);
    shell.exec(cmd);
  }
}
