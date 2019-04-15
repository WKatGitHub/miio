'use strict';

module.exports = function(str) {
	try {
		return JSON.parse(str);
	} catch(ex) {
		// Case 1 Load for devices fail as they return empty JSON payload fields
		// e.g. ,"ot":"ott", = ,, when device is not connected with Xiaomi servers
		//str = str.replace(',,"otu_stat"', ',"otu_stat"');
		str = str.replace(',,', ',');
		// Case 2: Load for subdevices fail as they return empty values
		str = str.replace('[,]', '[null,null]');

		return JSON.parse(str);
	}
};