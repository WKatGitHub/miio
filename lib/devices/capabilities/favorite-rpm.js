'use strict';

const { Thing, State } = require('abstract-things');
const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:favorite-rpm';
	}

	static availableAPI(builder) {
		builder.event('favoriteRpmChanged')
			.type('number')
			.description('favoriteRpm state has changed')
			.done();

		builder.action('favoriteRpm')
			.description('Get or set the favoriteRpm value')
			.argument('number', [300,2200], 'If provided, set the favoriteRpm to this value')
			.returns('number' , [300,2200])
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'favoriteRpm') {
			if(this.updateState('favoriteRpm', value)) {
				this.emitEvent('favoriteRpmChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}

	/**
	 * Get or set if the favoriteRpm value [300,2200].
	 */
    favoriteRpm(rpm=undefined) {
		if(rpm === undefined) {
			return  this.getState('favoriteRpm');
        }
		rpm = parseInt(rpm);
		if(isNaN(rpm)){ 
			throw new Error('Invalid favoriteRpm value `' + rpm + '`');
		} 
        if(rpm < 300){
            rpm = 300;
        } else if(rpm > 2200){
            rpm = 2200;
		}
		return this.changeFavoriteRpm(rpm)
			.then(() => this.getState('favoriteRpm'));
	}
	/**
	 * Set the favorite rpm.
	 */
	changeFavoriteRpm(rpm) {
		throw new Error('changeFavoriteRpm not implemented');
	}
});