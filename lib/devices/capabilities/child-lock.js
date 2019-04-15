'use strict';

const { Thing, State } = require('abstract-things');
const { boolean } = require('abstract-things/values');

const MiioApi = require('../../device');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:child-lock';
	}

	static availableAPI(builder) {
		builder.event('childLockChanged')
			.type('boolean')
			.description('ChildLock state has changed')
			.done();

		builder.action('childLock')
			.description('Get or set if the Child Lock is active')
			.argument('boolean', true, 'If provided, set the Child Lock to this value')
			.returns('boolean', 'If the Child Lock is on')
			.done();

		builder.action('setChildLock')
			.description('Set if the Child Lock is active')
			.argument('boolean', false, 'If provided, set the Child Lock to this value')
			.returns('boolean', 'If the Child Lock is on')
			.done();

		builder.action('getChildLock')
			.description('Get if the Child Lock is active')
			.returns('boolean', 'If the Child Lock is on')
			.done();
	}

	propertyUpdated(key, value) {
		if(key === 'childLock') {
			if(this.updateState('childLock', value)) {
				this.emitEvent('childLockChanged', value);
			}
		}

		super.propertyUpdated(key, value);
	}

	/**
	 * Get or set if the child lock is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch child lock to.
	 */
	childLock(active) {
		if(typeof active === 'undefined') {
			return this.getChildLock();
		}

		return this.setChildLock(active);
	}

	getChildLock() {
		return this.getState('childLock');
	}

	setChildLock(active) {
		active = boolean(active);

		return this.changeChildLock(active)
			.then(() => this.getChildLock());
	}

	changeChildLock(active) {
		return this.call('set_child_lock', [ active ? 'on' : 'off' ], {
			refresh: [ 'childLock' ]
		})
			.then(MiioApi.checkOk);
	}
});
