'use strict';

const { Thing, State } = require('abstract-things');
const { boolean } = require('abstract-things/values');

const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:turbo-mode';
	}

	static availableAPI(builder) {
		builder.event('turboModeChanged')
			.type('boolean')
			.description('TurboMode state has changed')
			.done();

		builder.action('turboMode')
			.description('Get or set if the TurboMode is active')
			.argument('boolean', true, 'If provided, set the TurboMode to this value')
			.returns('boolean', 'If the TurboMode is on')
			.done();

		builder.action('setTurboMode')
			.description('Set if the TurboMode is active')
			.argument('boolean', false, 'If provided, set the TurboMode to this value')
			.returns('boolean', 'If the TurboMode is on')
			.done();

		builder.action('getTurboMode')
			.description('Get if the TurboMode is active')
			.returns('boolean', 'If the TurboMode is on')
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'turboMode') {
			if(this.updateState('turboMode', value)) {
				this.emitEvent('turboModeChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}

	/**
	 * Get or set if the TurboMode is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch TurboMode to.
	 */
	turboMode(active) {
		if(typeof active === 'undefined') {
			return this.getTurboMode();
		}

		return this.setTurboMode(active);
	}

	getTurboMode() {
		return this.getState('turboMode');
	}

	setTurboMode(active) {
		active = boolean(active);

		return this.changeTurboMode(active)
			.then(() => this.getTurboMode());
	}

	changeTurboMode(active) {
		return this.call('set_app_extra', [ active ? 1 : 0 ], {
			refresh: [ 'turboMode' ]
		})
			.then(MiioApi.checkOk);
	}
});
