'use strict';

const { AirPurifier } = require('abstract-things/climate');
const MiioApi = require('../device');

const Power = require('./capabilities/power');
const Mode = require('./capabilities/mode');
//const FanSpeed = require('./capabilities/fan-speed');
const FavoriteLevel = require('./capabilities/favorite-level');
const LEDBrightness = require('./capabilities/changeable-led-brightness');
const Buzzer = require('./capabilities/buzzer');
const ChildLock = require('./capabilities/child-lock');
const Automation = require('./capabilities/automation');
const {AQI} = require('./capabilities/sensor');
/**
 * Abstraction over a Mi Air Purifier.
 *
 * Air Purifiers have a mode that indicates if is on or not. Changing the mode
 * to `idle` will power off the device, all other modes will power on the
 * device.
 */
module.exports = class extends AirPurifier
	.with(MiioApi, Power, Mode, FavoriteLevel, AQI, //FanSpeed,
		  LEDBrightness, Buzzer, ChildLock, Automation)
{

	static get type() {
		return 'miio:air-purifier-3';
	}

	constructor(options) {
		super(options);

		this._modes = ['auto','silent','favorite'];

		this._favoriteLevels = [350,700,750,800,850,1100,1150,1200,1300,1400,1500,1600,1700,1800,1900,2000,2200]; // 17 favorite levels of motor speed in rpm

		// Define the power property
		this.defineProperty({did: 'power', siid: 2, piid: 1});

		// Set the mode property and supported modes
		this.defineProperty({did: 'mode', siid: 2, piid: 4}, {
			mapper: v => {
				return this._modes[v] ? this._modes[v] : 'unknown';
			}
		});
		this.updateModes(this._modes);
		
		// Sensor value used for AQI (PM2.5) capability
		this.defineProperty({did: 'aqi', siid: 3, piid: 4});

		// Info about usage
		this.defineProperty({did: 'filterLifeRemaining', siid: 4, piid: 1});
		this.defineProperty({did: 'filterHoursUsed', siid: 4, piid: 3});

		// Buzzer and beeping
		this.defineProperty({did: 'buzzer', siid: 6, piid: 1});

		// Display brightness
		this.defineProperty({did: 'ledBrightness', siid: 7, piid: 2}, {
			mapper: v => {
				switch(v) { 
					case 0:
						return 0;
					case 1:
						return 25;
					case 2:
						return 50;
					case 3:
						return 75;
					case 8:	
						return 100;
					default:
						return 'unknown';
				}
			}
		});

		// Child Lock option
		this.defineProperty({did: 'childLock', siid: 8, piid: 1});

		// Speed of the electric motor in %
		this.defineProperty({did: 'motorSpeed', siid: 9, piid: 1}, {
			mapper: v => Math.round(v / 2200 * 100) // motor speed in %
		});

		// The favorite level
		this.defineProperty({did: 'favoriteRpm', siid: 9, piid: 3}, {
			name: 'favoriteLevel',
			mapper: v => {
				if(this._favoriteLevels.indexOf(v) !== -1){
					return this._favoriteLevels.indexOf(v);
				} else { // return the closest level value
					let maxLevel = this._favoriteLevels.length - 1;
					for(let i=0; i<maxLevel; i++) {
						if(Math.abs(v - this._favoriteLevels[i]) <= Math.abs(v - this._favoriteLevels[i+1])){
							v = i;
							break;
						}
					}
					if(v > maxLevel){
						v = maxLevel;
					}
				}
			}
		});

		// The fan speed in %
		// this.defineProperty({did: 'favoriteRpm', siid: 9, piid: 3}, {
		// 	name: 'fanSpeed',
		// 	mapper: v => {
		// 		const maxRpm = 2200;
		// 		return Math.round( v / maxRpm * 100);
		// 	}
		// });

	}

	changePower(power) {
		return this.call('set_properties', [{did: 'power', siid: 2, piid: 1, "value": power ? true : false }])
		.then((res) => { 
			if(MiioApi.checkCode0(res) === null) {
				this.setProperty('power', power);
				return null;
			}
		});
	}

	/**
	 * Perform a mode change as requested by `mode(string)` or
	 * `setMode(string)`.
	 */
	changeMode(mode) {
		let arg = this._modes.indexOf(mode);

		if(arg === -1){
			return Promise.reject(new Error('Mode `' + mode + '` not supported'));
		}

		return this.call('set_properties', [{did: 'mode', siid: 2, piid: 4, "value": arg }])
			.then((res) => { 
				if(MiioApi.checkCode0(res) === null) {
					this.setProperty('mode', mode);
					return null;
				}
			});
	}

	changeBuzzer(active) {
		return this.call('set_properties', [{did: 'buzzer', siid: 6, piid: 1, "value": active ? true : false }])
			.then((res) => { 
				if(MiioApi.checkCode0(res) === null) {
					this.setProperty('buzzer', active);
					return null;
				}
			});
	}

	/**
	 * Set the LED brightness to: 0, 25, 50, 75, 100 [%].
	 */
	changeLEDBrightness(level) {
		let arg;
		switch(level) {
			case 0:
				arg = 0;
				break;
			case 25:
				arg = 1;
				break;
			case 50:
				arg = 2;
				break;
			case 75:
				arg = 3;
				break;
			case 100:
				arg = 8;
				break;
			default:
				return Promise.reject(new Error('Invalid LED brigthness: ' + level));
		}

		return this.call('set_properties', [{did: 'ledBrightness', siid: 7, piid: 2, "value": arg }])
			.then((res) => { 
				if(MiioApi.checkCode0(res) === null) {
					this.setProperty('ledBrightness', level);
					return null;
				}
			});
	}

	changeChildLock(active) {
		return this.call('set_properties', [{did: 'childLock', siid: 8, piid: 1, "value": active ? true : false }])
			.then((res) => { 
				if(MiioApi.checkCode0(res) === null) {
					this.setProperty('childLock', active);
					return null;
				}
			});
	}

	changeFavoriteLevel(level) {
		return this.call('set_properties', [{did: 'favoriteRpm', siid: 9, piid: 3, value: this._favoriteLevels[level]}])
			.then((res) => { 
				if(MiioApi.checkCode0(res) === null) {
					this.setProperty('favoriteLevel', level);
					this.setProperty('power', true);
					this.setProperty('mode', 'favorite');
					return null;
				}
			});
	}

	// changeFanSpeed(speed) {
	// 	let arg= -1;
	// 	if(speed >= 0 && speed <= 100){
	// 		const maxRpm = 2200;
	// 		const levels =[350,700,750,800,850,1100,1150,1200,1300,1400,1500,1600,1700,1800,1900,2000,maxRpm]; // 17 levels of fanSpeed [rpm]

	// 		speed = maxRpm * speed / 100; // speed in rpm 

	// 		for(let i=0; i<levels.length-1; i++) {
	// 			if(Math.abs(speed - levels[i]) <= Math.abs(speed - levels[i+1])){
	// 				arg = levels[i];
	// 				break;
	// 			}
	// 		}
	// 		if(arg === -1){
	// 			arg = maxRpm;
	// 		}
	// 		speed = Math.round(arg / maxRpm * 100);

	// 	} else {
	// 		return Promise.reject(new Error('Invalid Fan Speed: `'+ speed +'`'));
	// 	}
	// 	return this.call('set_properties', [{did: 'favoriteRpm', siid: 9, piid: 3, value: arg}], { 
	// 		//refresh: ['fanSpeed', 'power', 'mode']
	// 	})
	// 		.then((res) => { 
	// 			if(MiioApi.checkCode0(res) === null) {
	// 				this.setProperty('fanSpeed', speed);
	// 				this.setProperty('power', true);
	// 				this.setProperty('mode', 'favorite');
	// 				return null;
	// 			}
	// 		});
	// }

};
