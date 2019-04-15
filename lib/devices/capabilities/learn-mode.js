'use strict';

const { Thing, State } = require('abstract-things');
const { boolean } = require('abstract-things/values');

const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:learn-mode';
	}

	static availableAPI(builder) {
		builder.event('learnModeChanged')
			.type('boolean')
			.description('LearnMode state has changed')
			.done();

		builder.action('learnMode')
			.description('Get or set if the LearnMode is active')
			.argument('boolean', true, 'If provided, set the LearnMode to this value')
			.returns('boolean', 'If the LearnMode is on')
			.done();

		builder.action('setLearnMode')
			.description('Set if the LearnMode is active')
			.argument('boolean', false, 'If provided, set the LearnMode to this value')
			.returns('boolean', 'If the LearnMode is on')
			.done();

		builder.action('getLearnMode')
			.description('Get if the LearnMode is active')
			.returns('boolean', 'If the LearnMode is on')
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'learnMode') {
			if(this.updateState('learnMode', value)) {
				this.emitEvent('learnModeChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}

	/**
	 * Get or set if the LearnMode is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch LearnMode to.
	 */
	learnMode(active) {
		if(typeof active === 'undefined') {
			return this.getLearnMode();
		}

		return this.setLearnMode(active);
	}

	getLearnMode() {
		return this.getState('learnMode');
	}

	setLearnMode(active) {
		active = boolean(active);

		return this.changeLearnMode(active)
			.then(() => this.getLearnMode());
	}

	changeLearnMode(active) {
		return this.call('set_act_sleep', [ active ? 'single' : 'close' ], {
			refresh: [ 'learnMode' ]
		})
			.then(MiioApi.checkOk);
	}
});
