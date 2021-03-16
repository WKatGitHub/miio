'use strict';

module.exports = function(hostname) {
	// Extract info via hostname structure
	let m = /(.+)_miio(\d+)/g.exec(hostname);

	if(! m) {
		m = /(.+)_miot(\d+)/g.exec(hostname);

		if(! m) {
			// Fallback for rockrobo - might break in the future
			if(/rockrobo/g.exec(hostname)) {
				return {
					model: 'rockrobo.vacuum.v1',
					type: 'vacuum'
				};
			}
			
			return null;
		}
	}

	const model = m[1].replace(/-/g, '.');

	return {
		model: model,
		id: m[2]
	};
};
