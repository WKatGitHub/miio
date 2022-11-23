'use strict';

const { Thing, State } = require('abstract-things');
const { percentage } = require('abstract-things/values');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:led-brightness';
	}

	static availableAPI(builder) {
		builder.action('ledBrightness')
			.description('Get or set the LED brightness')
			.argument('percentage', true, 'If provided, set the LED brightness to this value')
			.returns('percentage', 'The LED brightness')
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'ledBrightness') {
			this.updateState('ledBrightness', value);
		}

		super.propertyUpdated(key, value);
	}

	/**
	 * Get or set if the LED brightness.
	 *
	 * @param {percentage} brightness The LED brightness
	 */
	ledBrightness(brightness) {
		if(typeof brightness === 'undefined') {
			return this.getState('ledBrightness');
		}

		brightness = percentage(brightness);
		return this.changeLEDBrightness(brightness)
			.then(() => this.getState('ledBrightness'));
	}

	/**
	 * Set the LED brightness.
	 */
	changeLEDBrightness(brightness) {
		throw new Error('changeLEDBrightness not implemented');
	}
});
