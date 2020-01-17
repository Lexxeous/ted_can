#!/usr/bin/env node

const shell = require("shelljs");
const fs = require("fs");
const path = require("path");

//------------------------------------------- Setup Command Line Arguments ------------------------------------------//

const argv = require("yargs")
  .usage("Usage: $0 <command> [options]")
  .command({
    command: "make <device_type> <project_dir>",
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
    command: "flash <device_type> <ecu_id>",
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
    command: "all <device_type> <project_dir> <ecu_id>",
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
    alias: "custom_hex_file",
    describe: "Location of .hex file to use or build to",
  })
  .implies("s", "p") // if scenario file is given, that implies a program file must also be given
  .implies("s", "e") // if a scenario file is given, that implies an ECU ID must also be given
  .demandCommand(1, "You must provide at least one command from [\"all\", \"make\", \"flash\"] to proceed.")
  .help()
  .argv;

//--------------------------------------------- Define Global Variables ---------------------------------------------//

if(argv.scenario_file)
{
  var c_file_path = path.resolve(path.join(argv.project_dir, argv.program_file)); // string that points to <program_file> parameter
  var c_file = fs.readFileSync(c_file_path, { encoding: "utf8" }); // open the program file specified by the user
}

const t = argv.device_type;
const d = argv.project_dir;
const e = argv.ecu_id;
const s = argv.scenario_file;
const p = argv.program_file;
const h = argv.custom_hex_file;
const all_params = t && d && e && s && p && h;

//------------------------------------------- Implement Wrapper Functions -------------------------------------------//

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function that returns the new data for the written file. Separated to allow changes to be made easily.
function get_data_to_write(program_file, bytes)
{
  // Current method. Replaces a specific set of characters with the new code.
  return program_file.replace("// 0000 INSERT MESSAGE 0000 //\r\n", bytes);
}

function get_default_hex_file()
{
  let default_hex_dir = path.join(argv.project_dir, "dist/default/production");
  let hex_file_name = fs.readdirSync(default_hex_dir).find(e => path.extname(e) === ".hex");
  return path.join(default_hex_dir, hex_file_name);
}

function choose_hex_file()
{
  if(argv.custom_hex_file) // use custom .hex file path
  {
    hex_file_chosen = argv.custom_hex_file;
  }
  else // use default .hex file path from project directory structure
  {
    hex_file_chosen = get_default_hex_file();
  }

  return hex_file_chosen
}

function check_make()
{
  // Verify that "make" is available; "C:\Program Files (x86)\Microchip\MPLABX\v<X.Y.Z>\gnuBins\GnuWin32\bin" in PATH.
  if (!shell.which("make"))
  {
    console.log("The \"make\" executable is not available; ensure an appropriate version is set in your PATH.");
    process.exit();
  }
}

function check_ipecmd()
{
  // Verify that "ipecmd" is available; "C:\Program Files (x86)\Microchip\MPLABX\v<X.Y.Z>\mplab_platform\mplab_ipe" in PATH.
  if(!shell.which("ipecmd"))
  {
    console.log("The \"ipecmd\" executable is not available; ensure an appropriate version is set in your PATH.");
    process.exit();
  }
  else
    return;
}

function make_default_location()
{
  // shell.cd(argv.project_dir); // go to the project directory
  // shell.exec("make");
  shell.exec("cd " +  argv.project_dir + " && make"); // execute "make" in the project directory to compile the .hex file
}

function make_default_and_custom_locations()
{
  make_default_location();
  default_hex_file_path = get_default_hex_file();
  shell.cp(default_hex_file_path, argv.custom_hex_file);
}

function revert_program_file_changes(c_file, c_file_path)
{
  fs.writeFileSync(c_file_path, c_file);
}

function inject_scenario(c_file, c_file_path)
{
  let data = fs.readFileSync(argv.scenario_file, { encoding: "utf8" }); // read the scenario file
  var messages = {}; // list of messages to be sent/received by the ECU's

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
  
  // Write the data to the program file.
  bytes = bytes.slice(0, -1) + "};\r\n"; // finish off the data
  let full_data = get_data_to_write(c_file, bytes); // original .c file with scenario data
  fs.writeFileSync(c_file_path, full_data); // overwrites/inserts scenario data
}

function flash_ecu(hfc)
{
  if(!(argv.device_type && argv.ecu_id && hfc))
  {
    console.log("\nERROR::160::BAD_ARGUMENTS")
    console.log("You must specify a device type, an ECU ID, and a project directory or custom .hex file path like:")
    process.exit();
  }

  console.log("I GOT HERE BOI 2");

  // Adjust device name to fit the ipecmd format.
  let part_name = argv.device_type;
  if (part_name.startsWith("PIC")) part_name = part_name.slice(3);
  else if (part_name.startsWith("dsPIC")) part_name = part_name.slice(5);
  else if (part_name.startsWith("rfPIC")) part_name = part_name.slice(5);

  // Prepare "ipecmd" command.
  let cmd = "ipecmd -TPPKOB -M -OL";
  cmd += " -P" + part_name; // specify the <part_name> option given by the user
  cmd += " -F" + hfc;
  cmd += " -TS"+ "BUR171520074" // specify the <sn> given by the user to uniquely identify the MCU

  shell.exec("start python usbhub3p_ctrl.py " + argv.ecu_id) // isolate correct USB hub port
  shell.exec("start " + cmd);
  shell.exec("start rm log.* && rm MPLABXLog.*") // remove all of the temporary log files

  console.log("I GOT HERE BOI 3");
}


var hex_file_chosen = choose_hex_file() // choosing between default or custom .hex file


//------------------------------------------- Implement Main Command Cases ------------------------------------------//

// Divide specific commands and cases; "Yargs" will handle the default cases when insufficient parameters are provided.
if(argv._[0] === "make")
{
  check_make();

  if(all_params)
  {
    // inject scenario into .c file and "make" .hex to default and custom location
  }
  else if(t && d && e && s && p && !h) // every parameter except <argv.custom_hex_file>
  {
    // inject scenario into .c file and "make" .hex to default location
  }
  else if(t && d && !e && !s && !p && !h) // minimal parameter requirements for make
  {
    // "make" .hex to default location without scenario
    // console.log("I GOT HERE TO THE MAKE BOI");
    // make_default_location();
  }
}
else if(argv._[0] === "flash")
{
  check_ipecmd();

  if(t && d && e && !s && !p && h)
  {
    // error, conflicting .hex file locations
  }
  else if(t && !d && e && !s && !p && !h)
  {
    // error, no .hex file location specified
  }
  else if(t && d && e && !s && !p && !h)
  {
    // Flash the specified ECU with the default .hex file from the project directory.
    flash_ecu(hex_file_chosen);
  }
  else if(t && !d && e && !s && !p && h)
  {
    // flash the specified ECU with the custom .hex file from separate directory
  }
}
else if(argv._[0] === "all")
{
  check_make();
  check_ipecmd();

  if(all_params)
  {
    // inject scenario into .c file, "make" .hex to default and custom locations, and flash with either
  }
  else if(t && d && e && s && p && !h)
  {
    // inject scenario into .c file, "make" .hex to default location, and flash default .hex file
  }
  else if(t && d && e && !s && !p && h)
  {
    // no scenario to inject, "make" to default and custom locations, and flash with either
  }
  else if(t && d && e && !s && !p && !h)
  {
    // no scenario to inject, "make" to default location, and flash with default .hex file
    // console.log("I GOT HERE BOI 111");
    make_default_location();
    // await sleep(7000);
    // console.log(shell.exec(pwd).stdout);
    // flash_ecu(hex_file_chosen);
  }
}
else
{
  console.log(argv._[0] + " is not a valid command, use \"make\", \"flash\", or \"all\".");
  process.exit();
}


// COMMAND: "make". Builds an MPLABX project. Also runs this if "all" is the command.
// if (argv._[0] === "make" || argv._[0] === "all")
// {
//   else if(!scenario_file)
//   {
//     make_default_location();
//   }
// }
