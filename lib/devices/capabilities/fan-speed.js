'use strict';

const { Thing } = require('abstract-things');
const { AdjustableFanSpeed } = require('abstract-things/climate');


module.exports = Thing.mixin(Parent => class extends Parent.with(AdjustableFanSpeed) {
	propertyUpdated(key, value) {
		if(key === 'fanSpeed' && value !== undefined) {
			this.updateFanSpeed(value);
		}

		super.propertyUpdated(key, value);
	}
});