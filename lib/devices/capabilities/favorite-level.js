'use strict';

const { Thing, State } = require('abstract-things');
const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:turbo-mode';
	}

	static availableAPI(builder) {
		builder.event('favoriteLevelChanged')
			.type('number')
			.description('favoriteLevel state has changed')
			.done();

		builder.action('favoriteLevel')
			.description('Get or set the favoriteLevel value')
			.argument('number', [1,16], 'If provided, set the favoriteLevel to this value')
			.returns('number' , [1,16])
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
	 * Get or set if the favoriteLevel value [1,16].
	 */
    favoriteLevel(level=undefined) {
		if(level === undefined) {
			return  this.getState('favoriteLevel');
        }
		level = parseInt(level);
		if(isNaN(level)){ 
			throw new Error('Invalid favoriteLevel value `' + level + '`');
		} 
        if(level < 1){
            level = 1;
        } else if(level > 16){
            level = 16;
		}
		return this.changeFavoriteLevel(level)
			.then(() => this.getState('favoriteLevel'));
	}

	changeFavoriteLevel(level) {
			return this.call('set_level_favorite', [ level ], { 
				refresh: ['favoriteLevel']
			}).then(MiioApi.checkOk)
	}
});