# coding: utf-8

#----------------------------------------------------- Licensing -----------------------------------------------------#

# Copyright (c) 2018 Acroname Inc. - All Rights Reserved
#
# This file is part of the BrainStem development package.
# See file LICENSE or go to https://acroname.com/software/brainstem-development-kit for full license details.

#--------------------------------------------- Import Necessary Libraries --------------------------------------------#

import brainstem
from brainstem.result import Result # for easy access to error constants
import time
import os.path
import sys # for sys.argv[n]

#------------------------------------------- Import Custom Utility Modules -------------------------------------------#

sys.path.append(os.path.join(os.path.dirname(__file__), '.', "utilities")) # add "../utilities" to module import search path
import usbhub3p_ctrl_utils as hub3p # for custom "usbhub3p_ctrl_utils" utility functions

#--------------------------------------------------- Global Variables ------------------------------------------------#

usb_hub_sn = 0xA360110F
ecu_arg = 1
ecu_id = 3

#---------------------------------------------- Print USB Control Command --------------------------------------------#

print "\npython",
for i in range(0, len(sys.argv)):
	print sys.argv[i],

#------------------------------------------------- Connect to USB Hub ------------------------------------------------#

# Create USBHub3p object and connect
print "\n\nCreating USBHub3p stem object and connecting to hardware..."
stem = brainstem.stem.USBHub3p()

# Locate and connect to a specific module (replace you with Your Serial Number (hex))
result = stem.discoverAndConnect(brainstem.link.Spec.USB, usb_hub_sn)

#----------------------------------------------- Enable Correct Port(s) ----------------------------------------------#

# Check error
if result == (Result.NO_ERROR):
  result = stem.system.getSerialNumber()
  print "Connected to USBStem with serial number: 0x%08X." % result.value

  hub3p.hub3p_isolate_port(stem, int(sys.argv[ecu_arg][ecu_id])) # enable only one port at a time

else:
  print "Could not find a module with which to connect.\n"

stem.disconnect() # disconnect from device

#-------------------------------------------------- Useful Functions -------------------------------------------------#

# stem.usb.setPortEnable(<int>)
# stem.usb.setPowerEnable(<int>) # for independent power control
# stem.usb.setDataEnable(<int>) # for independent data control
# stem.system.setLED(<int>) # for setting the user LED on the back
# time.sleep(<int>)