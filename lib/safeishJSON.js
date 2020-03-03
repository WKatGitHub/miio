'use strict';

module.exports = function(str) {
	try {
		return JSON.parse(str);
	} catch(ex) {
		// Load for subdevices fail as they return empty values
		str = str.replace('[,]', '[null,null]');
		// for aqara body sensor (lumi.motion.aq2)
		str = str.replace('[,,]', '[null,null,null]');
		// for Xiaomi Air Purifier m1 without internet access
		//str = str.replace(',,"otu_stat"', ',"otu_stat"');
		str = str.replace(',,', ',');
		return JSON.parse(str);
	}
};