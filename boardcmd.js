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
    alias: "program",
    describe: "name of the program file (must be in project directory)"
  })
  .implies("s", "p")
  .option("e", {
    alias: "ecu_id",
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
  console.log(argv._[0] + " is not a valid command, try \'make\', \'flash\', or \'all\'.");
  process.exit(1);
}

// Function that returns the new data for the written file. Separated to allow changes to be made easily.
function getDataToWrite(program_file, bytes)
{
  // Current method. Replaces a specific set of characters with the new code.
  return program_file.replace("// 0000 INSERT MESSAGE 0000 //\r\n", bytes);
}


// Need this to tell if all is called in the flash function.
var hex_file;

// COMMAND: MAKE. Builds an MPLab project. Also runs this if all is the command.
if (argv._[0] === "make" || argv._[0] === "all") {
  // Verify that make is available.
  if (!shell.which("make")) {
    console.log("make is not available.");
  } else {
    // These will be used to rewrite the original program file if it is changed.
    var program_file, program_path;

    // Do this if there is a scenario file to be included.
    if (argv.scenario) {
      // Read in scenario file.
      let data = fs.readFileSync(argv.scenario, { encoding: "utf8" });

      // List of messages to be sent/received by the ECU's.
      var messages = {};

      // Get each line from the scenario file and parse it, separating out the messages for each ECU.
      // TODO: Allow for formats such as DBC
      data.split("\r\n").forEach(function (e) {
        let values = e.split(" ");
        let idx = values[0]; // row index
        let ecu_id = values[1]; // ECU<n>
        let send_mode = values[2]; // Tx or Rx
        if (!messages.hasOwnProperty(ecu_id)) {
          messages[ecu_id] = {
            Tx: [],
            Rx: [],
            total: 0
          };
        }
        messages[ecu_id][send_mode].push({
          sequence_number: values[0],
          message_id: values[3], // the arbitration ID
          data: values.slice(4) // 8 bytes of hexidecimal formatted CAN payload
        });
        messages[ecu_id].total++;
      });

      // Go through the ECU's messages and create its edited program (.c) file.
      let ecu_id = argv.ecu_id;
      // String containing information to be written to the file.
      var bytes = "struct Message messages[" + messages[ecu_id].total + "] = {\r\n";

      // Format the transmit data to be used in the C file.
      messages[ecu_id].Tx.forEach(m => {
        // Convert the eight data (string) values into four C-compliant hexadecimal values.
        // The final format of this string is `{0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}`.
        let data = "{0x" + m.data.map((e, j, a) => {
          if (j % 2 == 1) return undefined;
          return e + (a[j + 1] || "00");
        }).filter(e => e).join(", 0x") + "}";

        // The comes out to something like `{1, "ECU1", "Tx", 101, {0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}}`.
        bytes += "{" + m.sequence_number + ', "' + ecu_id + '", "Tx", ' + m.message_id + ", " + data + "},\r\n";
      });

      // Format the receive data to be used in the C file.
      messages[ecu_id].Rx.forEach(m => {
        // The comes out to something like `{0, "ECU1", "Rx", 101, {}}`.
        bytes += '{0, "' + ecu_id + '", "Rx", ' + m.message_id + ", {}},\r\n";
      });
      // Finish off the data.
      bytes = bytes.slice(0, -1) + "};\r\n";

      // String that points to program file.
      program_path = path.resolve(path.join(argv.project_directory, argv.program));

      // Open the program file specified by the user.
      program_file = fs.readFileSync(program_path, { encoding: "utf8" });

      // Write the data to the program file.
      let full_data = getDataToWrite(program_file, bytes);
      fs.writeFileSync(program_path, full_data);

      // Go to project directory.
      shell.cd(argv.project_directory);

      // Execute make in the project directory to compile the hex file.
      shell.exec("make");

      // Revert file changes.
      fs.writeFileSync(program_path, program_file);

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

// COMMAND: "flash". Flash a hex file onto an ECU. Also runs this if "all" is the command.
if (argv._[0] === "flash" || argv._[0] === "all") {
  // Verify that ipecmd is available.
  // "/Applications/microchip/mplabx/v5.20/mplab_platform/mplab_ipe/ipecmd.jar" on macOS
  // "C:\Program Files (x86)\Microchip\MPLABX\v5.20\mplab_platform\mplab_ipe\ipecmd.jar" on Windows
  if (!shell.which("ipecmd"))
  {
    console.log("Cannot run this task, ipecmd not available.");
  }
  else
  {
    // Adjust device name to fit the ipecmd format.
    let part_name = argv.device_type;
    if (part_name.startsWith("PIC")) part_name = part_name.slice(3);
    else if (part_name.startsWith("dsPIC")) part_name = part_name.slice(5);
    else if (part_name.startsWith("rfPIC")) part_name = part_name.slice(5);

    // Prepare ipecmd.
    let cmd = "ipecmd -TPPKOB -M -OL";
    cmd += " -P" + part_name; // specify the <part_name> option given by the user
    cmd += " -F" + (hex_file || argv.hex_file); // specify <hex_file> optoin given by the user from directory structure
    cmd += " -TS"+ "BUR171520074" // specify the <sn> given by the user to uniquely identify the MCU

    if(argv.ecu_id == undefined)
    {
      console.log("\nERROR::160::BAD_ARGUMENTS")
      console.log("You must specify an ECU ID option like: \"-e ECU<n>\" (0 ≤ n < 7) to flash a board.")
      process.exit();
    }

    shell.exec("python usbhub3p_ctrl.py " + argv.ecu_id) // isolate correct USB hub port
    console.log(cmd);
    shell.exec(cmd);
    shell.exec("rm log.* && rm MPLABXLog.*") // remove all of the temporary log files
  }
}
