# coding: utf-8

#--------------------------------------------- Import Necessary Libraries --------------------------------------------#

import brainstem

#--------------------------------------------------- Global Variables ------------------------------------------------#

port_count = 8

#---------------------------------------------- Utilities Implementation ---------------------------------------------#

# Loop through all 8 ports, disable them all except for the port specified by <p>, using the "brainstem" object <s>
def hub3p_isolate_port(s, p):
	for i in range(0, port_count):
		if (i != p):
			s.usb.setPortDisable(i)
		else:
			print "Disabling all ports except port number " + str(p) + "..." 
			s.usb.setPortEnable(p)