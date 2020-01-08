# coding: utf-8

#----------------------------------------------------- Licensing -----------------------------------------------------#

# Copyright (c) 2018 Acroname Inc. - All Rights Reserved
#
# This file is part of the BrainStem development package.
# See file LICENSE or go to https://acroname.com/software/brainstem-development-kit for full license details.

#--------------------------------------------- Import Necessary Libraries --------------------------------------------#

import brainstem
from brainstem.result import Result #for easy access to error constants
import time
import sys # for sys.argv[n]

#------------------------------------------------- Connect to USB Hub ------------------------------------------------#

# Create USBHub3p object and connect
print "\nCreating USBHub3p stem and connecting to hardware..."
stem = brainstem.stem.USBHub3p()

# Locate and connect to a specific module (replace you with Your Serial Number (hex))
result = stem.discoverAndConnect(brainstem.link.Spec.USB, 0xA360110F)

#----------------------------------------------- Enable Correct Port(s) ----------------------------------------------#

# Check error
if result == (Result.NO_ERROR):
  result = stem.system.getSerialNumber()
  print "Connected to USBStem with serial number: 0x%08X" % result.value

  stem.usb.setPortDisable(0)
  # stem.usb.setPortEnable(0)
else:
  print "Could not find a module with which to connect.\n"

stem.disconnect() # disconnect from device

#-------------------------------------------------- Useful Functions -------------------------------------------------#

# stem.usb.setPortEnable(<int>)
# stem.usb.setPowerEnable(<int>) # for independent power control
# stem.usb.setDataEnable(<int>) # for independent data control
# stem.system.setLED(<int>) # for setting the user LED on the back
# time.sleep(<int>)