'use strict';

const { Thing, State } = require('abstract-things');
const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:favorite-level';
	}

	static availableAPI(builder) {
		builder.event('favoriteLevelChanged')
			.type('number')
			.description('favoriteLevel state has changed')
			.done();

		builder.action('favoriteLevel')
			.description('Get or set the favoriteLevel value')
			.argument('number', [0,16], 'If provided, set the favoriteLevel to this value')
			.returns('number' , [0,16])
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'favoriteLevel') {
			if(this.updateState('favoriteLevel', value)) {
				this.emitEvent('favoriteLevelChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}


	/**
	 * Get or set if the favoriteLevel value [0,16].
	 */
    favoriteLevel(level=undefined) {
		if(level === undefined) {
			return  this.getState('favoriteLevel');
        }
		level = parseInt(level);
		if(isNaN(level)){ 
			throw new Error('Invalid favoriteLevel value `' + level + '`');
		} 
        if(level < 0){
            level = 0;
        } else if(level > 16){
            level = 16;
		}
		return this.changeFavoriteLevel(level)
			.then(() => this.getState('favoriteLevel'));
	}

	/**
	 * Set the favorite Level.
	 */
	changeFavoriteLevel(level) {
		throw new Error('changeFavoriteLevel not implemented');
	}
});