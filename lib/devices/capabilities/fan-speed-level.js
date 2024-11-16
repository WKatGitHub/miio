'use strict';

const { Thing, State } = require('abstract-things');
const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:fan-speed-level';
	}

	static availableAPI(builder) {
		builder.event('fanSpeedLevelChanged')
			.type('number')
			.description('fanSpeedLevel state has changed')
			.done();

		builder.action('fanSpeedLevel')
			.description('Get or set the fanSpeedLevel value')
			.argument('number', [0,16], 'If provided, set the fanSpeedLevel to this value')
			.returns('number' , [0,16])
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'fanSpeedLevel') {
			if(this.updateState('fanSpeedLevel', value)) {
				this.emitEvent('fanSpeedLevelChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}


	/**
	 * Set if the fanSpeedLevel value [0,16] or get [0,16]-% maxspeed.
	 */
    fanSpeedLevel(level=undefined) {
		if(level === undefined) {
			return  this.getState('fanSpeedLevel');
        }
		level = parseInt(level);
		if(isNaN(level)){ 
			throw new Error('Invalid fanSpeedLevel value `' + level + '`');
		} 
        if(level < 0){
            level = 0;
        } else if(level > 16){
            level = 16;
		}
		return this.changeFanSpeedLevel(level)
			.then(() => this.getState('fanSpeedLevel'));
	}

	/**
	 * Set the fan speed Level.
	 */
	changeFanSpeedLevel(level) {
		throw new Error('changeFanSpeedLevel not implemented');
	}
});
