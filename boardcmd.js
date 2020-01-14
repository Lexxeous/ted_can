#!/usr/bin/env node
const shell = require("shelljs");
const fs = require("fs");
const path = require("path");

// Set up command line arguments.
const argv = require("yargs")
  .usage("Usage: $0 <command> [options]")
  .command({
    command: "make <device_type> <project_dir> [-s -p -e] OR [-s -p -e -h]",
    alias: "m",
    describe: "Build existing MPLABX project into a .hex file",
    builder: yargs => {
      yargs
      .positional("device_type", {
        describe: "Name of MCU chip (e.g. dsPIC33EV256GM106)"
      })
      .positional("project_dir", {
        describe: "Directory for existing MPLABX project",
        default: "."
      });
    }
  })
  .command({
    command: "flash <device_type> <ecu_id> ( <project_dir> XOR <custom_hex> )",
    alias: "f",
    describe: "Flash a .hex file onto a specific ECU",
    builder: yargs => {
      yargs
      .positional("device_type", {
        describe: "Name of MCU chip (e.g. dsPIC33EV256GM106)"
      })
      .positional("ecu_id", {
        describe: "Specific ECU being programmed (e.g. ECU3)"
      });
    }
  })
  .command({
    command: "all <device_type> <project_dir> <ecu_id> [-h] OR [-s -p] OR [-s -p -h]",
    alias: "a",
    describe: "Build a project and then flash it onto a specific ECU",
    builder: yargs => {
      yargs
      .positional("device_type", {
        describe: "Name of MCU chip (e.g. dsPIC33EV256GM106)"
      })
      .positional("project_dir", {
        describe: "Directory for existing MPLABX project"
      })
      .positional("ecu_id", {
        describe: "Specific ECU being programmed (e.g. ECU3)"
      });
    }
  })
  .option("s", {
    alias: "scenario_file",
    describe: "Scenario file to be used when building existing project"
  })
  .option("p", {
    alias: "program_file",
    describe: "Name of .c program file (in root of .X project directory)"
  })
  .option("e", {
    alias: "ecu_id",
    describe: "Specific ECU being programmed (e.g. ECU3)"
  })
  .option("d", {
    alias: "project_dir",
    describe: "Directory for existing MPLABX project",
    default: "."
  })
  .option("h", {
    alias: "custom_hex",
    describe: "Location of .hex file to use or build to",
  })
  .implies("s", "p") // if scenario file is given, that implies a program file must also be given
  .implies("s", "e") // if a scenario file is given, that implies an ECU ID must also be given
  .demandCommand(1, "You must provide at least one command from [\"all\", \"make\", \"flash\"] to proceed.")
  .help()
  .argv;


// Function that returns the new data for the written file. Separated to allow changes to be made easily.
function getDataToWrite(program_file, bytes)
{
  // Current method. Replaces a specific set of characters with the new code.
  return program_file.replace("// 0000 INSERT MESSAGE 0000 //\r\n", bytes);
}

function choose_hex_file()
{
  if(argv.custom_hex) // use custom .hex file path
  {
    hex_file_chosen = argv.custom_hex;
  }
  else // use default .hex file path from project directory structure
  {
    let output_dir = path.join(argv.project_dir, "dist/default/production");
    let hex_file_name = fs.readdirSync(output_dir).find(e => path.extname(e) === ".hex");
    hex_file_chosen = path.join(output_dir, hex_file_name);
  }

  return hex_file_chosen
}

const all_params = argv.device_type && argv.project_dir && argv.ecu_id && argv.scenario_file && argv.program_file && argv.custom_hex;
var hex_file_chosen = choose_hex_file() // choosing between default or custom .hex file path

// Divide specific commands and cases; Yargs will handle the default cases when insufficient parameters are provided.
if(argv._[0] === "make")
{
  if(all_params)
  {
    // inject scenario into .c file and "make" .hex to default and custom location
  }
  else if(argv.device_type && argv.project_dir && argv.ecu_id && argv.scenario_file && argv.program_file) // all but <custom_hex>
  {
    // inject scenario into .c file and "make" .hex to default location
  }
  else if(argv.device_type && argv.project_dir) // minimal parameter requirements for make
  {
    // "make" .hex to default location without scenario
  }
}
else if(argv._[0] === "flash")
{

}
if(argv._[0] === "all")
{
  // 1
  // 2
  // 3
  // 4
}
else
{
  console.log(argv._[0] + " is not a valid command, use \"make\", \"flash\", or \"all\".");
  process.exit(1);
}


// COMMAND: "make". Builds an MPLABX project. Also runs this if "all" is the command.
if (argv._[0] === "make" || argv._[0] === "all")
{
  // Verify that make is available.
  if (!shell.which("make"))
  {
    console.log("The \"make\" executable is not available; ensure an appropriate version is set in your PATH.");
  }
  else
  {
    // These will be used to rewrite the original program file if it is changed.
    var program_file, program_path;

    // Do this if there is a scenario file to be included.
    if(argv.scenario_file)
    {
      // Read in scenario file.
      let data = fs.readFileSync(argv.scenario_file, { encoding: "utf8" });

      // List of messages to be sent/received by the ECU's.
      var messages = {};

      // Get each line from the scenario file and parse it, separating out the messages for each ECU.
      // TODO: Allow for formats such as DBC
      data.split("\r\n").forEach(function (e) {
        let values = e.split(" ");
        let idx = values[0]; // row index
        let ecu_num = values[1]; // ECU<n>
        let send_mode = values[2]; // Tx or Rx
        if (!messages.hasOwnProperty(ecu_num))
        {
          messages[ecu_num] = {
            Tx: [],
            Rx: [],
            total: 0
          };
        }
        messages[ecu_num][send_mode].push({
          sequence_number: values[0],
          message_id: values[3], // the arbitration ID
          data: values.slice(4) // 8 bytes of hexidecimal formatted CAN payload
        });
        messages[ecu_num].total++;
      });

      let ecu_num = argv.ecu_id; // go through the ECU's messages and create its edited program (.c) file
      var bytes = "struct Message messages[" + messages[ecu_num].total + "] = {\r\n"; // information to be written to file

      // Format the transmit data to be used in the C file.
      messages[ecu_num].Tx.forEach(m => {
        // Convert the eight data (string) values into four C-compliant hexadecimal values.
        // The final format of this string is `{0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}`.
        let data = "{0x" + m.data.map((e, j, a) => {
          if (j % 2 == 1) return undefined;
          return e + (a[j + 1] || "00");
        }).filter(e => e).join(", 0x") + "}";

        // The comes out to something like `{1, "ECU1", "Tx", 101, {0xXXXX, 0xXXXX, 0xXXXX, 0xXXXX}}`.
        bytes += "{" + m.sequence_number + ', "' + ecu_num + '", "Tx", ' + m.message_id + ", " + data + "},\r\n";
      });

      // Format the receive data to be used in the C file.
      messages[ecu_num].Rx.forEach(m => {
        // The comes out to something like `{0, "ECU1", "Rx", 101, {}}`.
        bytes += '{0, "' + ecu_num + '", "Rx", ' + m.message_id + ", {}},\r\n";
      });
      
      bytes = bytes.slice(0, -1) + "};\r\n"; // finish off the data
      program_path = path.resolve(path.join(argv.project_dir, argv.program)); // string that points to program file
      program_file = fs.readFileSync(program_path, { encoding: "utf8" }); // open the program file specified by the user

      // Write the data to the program file.
      let full_data = getDataToWrite(program_file, bytes); // original .c file with scenario data
      fs.writeFileSync(program_path, full_data); // overwrites/inserts scenario data

      shell.cd(argv.project_dir); // go to the project directory
      shell.exec("make"); // execute "make" in the project directory to compile the .hex file
      fs.writeFileSync(program_path, program_file); // revert file changes
    }
    else if(!scenario_file)
    {
      shell.cd(argv.project_dir); // go to the project directory
      shell.exec("make"); // execute "make" in the project directory to compile the .hex file
    }
  }
}

// COMMAND: "flash". Flash a hex file onto an ECU. Also runs this if "all" is the command.
if (argv._[0] === "flash" || argv._[0] === "all") {
  // Verify that ipecmd is available.
  // "/Applications/microchip/MPLABXx/v5.20/MPLABX_platform/MPLABX_ipe/ipecmd.jar" on macOS
  // "C:\Program Files (x86)\Microchip\MPLABXX\v5.20\MPLABX_platform\MPLABX_ipe\ipecmd.jar" on Windows
  if (!shell.which("ipecmd"))
  {
    console.log("The \"ipecmd\" executable is not available; ensure an appropriate version is set in your PATH.");
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
    cmd += " -F" + (hex_file_chosen || argv.custom_hex);
    cmd += " -TS"+ "BUR171520074" // specify the <sn> given by the user to uniquely identify the MCU

    if(!argv.device_type || !argv.custom_hex || !argv.ecu_id)
    {
      console.log("\nERROR::160::BAD_ARGUMENTS")
      console.log("You must specify a device type, a hex file, and an ECU ID like:")
      console.log("\"node boardcmd.js flash <device_type> <hex_file_path> <ECUn>\" (where: 0 ≤ n < 7) to flash a board.")
      process.exit();
    }

    shell.exec("python usbhub3p_ctrl.py " + argv.ecu_id) // isolate correct USB hub port
    console.log(cmd);
    shell.exec(cmd);
    shell.exec("rm log.* && rm MPLABXXLog.*") // remove all of the temporary log files
  }
}
