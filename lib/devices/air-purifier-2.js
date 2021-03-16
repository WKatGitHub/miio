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
const { Temperature, Humidity, AQI } = require('./capabilities/sensor');

/**
 * Abstraction over a Mi Air Purifier.
 *
 * Air Purifiers have a mode that indicates if is on or not. Changing the mode
 * to `idle` will power off the device, all other modes will power on the
 * device.
 */
module.exports = class extends AirPurifier
	.with(MiioApi, Power, Mode, FavoriteLevel, Temperature, Humidity, AQI, //FanSpeed,
		  LEDBrightness, Buzzer, ChildLock, Automation)
{

	static get type() {
		return 'miio:air-purifier-2';
	}

	constructor(options) {
		super(options);

		// Define the power property
		this.defineProperty('power', v => v === 'on');

		// Set the mode property and supported modes
		this.defineProperty('mode');
		this.updateModes([
			'idle',

			'auto',
			'silent',
			'favorite'
		]);

		// Sensor value for Temperature capability
		this.defineProperty('temp_dec', {
			name: 'temperature',
			mapper: v => v / 10.0
		});

		// Sensor value for RelativeHumidity capability
		this.defineProperty('humidity');

		// Sensor value used for AQI (PM2.5) capability
		this.defineProperty('aqi');

		// Amount of purified air in cubic meters
		this.defineProperty('purify_volume', {
			name: 'purifyVolume'
		});

		// Info about usage
		this.defineProperty('filter1_life', {
			name: 'filterLifeRemaining'
		});
		this.defineProperty('f1_hour_used', {
			name: 'filterHoursUsed'
		});

		// Buzzer and beeping
		this.defineProperty('buzzer', {
			mapper: v => v === 'on'
		});
		
		this.defineProperty('led_b', {
			name: 'ledBrightness',
			mapper: v => {
				switch(v) {
					case 0:
						return 100;
					case 1:
						return 50;
					case 2:
						return 0;
					default:
						return 'unknown';
				}
			}
		});

		// Child Lock option
		this.defineProperty('child_lock', {
			name: 'childLock',
			mapper: v => v === 'on'
		});

		// Speed of the electric motor in %
		this.defineProperty('motor1_speed', {
			name: 'motorSpeed',
			mapper: v => Math.round(v / 2100 * 100) // motor speed in %
		});

		// The favorite level
		this.defineProperty('favorite_level', {
			name: 'favoriteLevel'
		});

		// The fan speed in %
		// this.defineProperty('favorite_level', {
		// 	name: 'fanSpeed',
		// 	mapper: v => {
		// 		const maxRpm = 2100;
		// 		const levels =[350,700,750,800,850,1100,1150,1200,1400,1500,1700,1800,1900,1950,2000,2050,maxRpm]; // 17 levels of fanSpeed [rpm]
		// 		return Math.round( levels[v] / maxRpm * 100);
		// 	}
		// });
	}

	changePower(power) {
		return this.call('set_power', [ power ? 'on' : 'off' ], {
			//refresh: [ 'power', 'mode' ],
			//refreshDelay: 200
		})
		.then((res) => { 
			if(MiioApi.checkOk(res) === null) {
				this.setProperty('power', power);
				if(!power){
					this.setProperty('mode','idle');
				}
				return null;
			}
		});
	}

	/**
	 * Perform a mode change as requested by `mode(string)` or
	 * `setMode(string)`.
	 */
	changeMode(mode) {
		return this.call('set_mode', [ mode ], {
			//refresh: [ 'power', 'mode' ],
			//refreshDelay: 200
		})	
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('mode', mode);
					this.setProperty('power', mode === 'idle' ? false : true);

					return null;
				}
			})	
			.catch(err => {
				throw err.code === -5001 ? new Error('Mode `' + mode + '` not supported') : err;
			});
	}

	changeBuzzer(active) {
		return this.call('set_buzzer', [ active ? 'on' : 'off' ], {
			//refresh: [ 'buzzer' ]
		})
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('buzzer', active);
					return null;
				}
			});

	}

	/**
	 * Set the LED brightness to: 0, 50, 100 [%].
	 */
	changeLEDBrightness(level) {
		let arg;
		switch(level) {
			case 100:
				arg = 0;
				break;
			case 50:
				arg = 1;
				break;
			case 0:
				arg = 2;
				break;
			default:
				return Promise.reject(new Error('Invalid LED brigthness: ' + level));
		}
		return this.call('set_led_b', [ arg ], { 
			//refresh: [ 'ledBrightness' ] 
		})
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('ledBrightness', level);
					return null;
				}
			});
	}

	changeChildLock(active) {
		return this.call('set_child_lock', [ active ? 'on' : 'off' ], {
			//refresh: [ 'childLock' ]
		})
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('childLock', active);
					return null;
				}
			});
	}

	changeFavoriteLevel(level) {
		return this.call('set_level_favorite', [ level ], { 
			//refresh: ['favoriteLevel']
		})
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('favoriteLevel', level);
					return null;
				}
			});
	}


	// changeFanSpeed(speed) {
	// 	let arg= -1;
	// 	if(speed >= 0 && speed <= 100){
	// 		const maxRpm = 2100;
	// 		const levels =[350,700,750,800,850,1100,1150,1200,1400,1500,1700,1800,1900,1950,2000,2050,maxRpm]; // 17 levels of fanSpeed [rpm]
	// 		const maxIndex = levels.length - 1;
			
	// 		speed = maxRpm * speed / 100; // speed in rpm

	// 		for(let i=0; i<maxIndex; i++) {
	// 			if(Math.abs(speed - levels[i]) <= Math.abs(speed - levels[i+1])){
	// 				arg = i;
	// 				break;
	// 			}
	// 		}
	// 		if(arg === -1){
	// 			arg = maxIndex; 
	// 		}
	// 		speed = Math.round(levels[arg] / maxRpm * 100);

	// 	} else {
	// 		return Promise.reject(new Error('Invalid Fan Speed: `'+ speed +'`'));
	// 	}
	// 	return this.call('set_level_favorite', [ arg ], { 
	// 		//refresh: ['fanSpeed']
	// 	})
	// 		.then((res) => { 
	// 			if(MiioApi.checkOk(res) === null) {
	// 				this.setProperty('fanSpeed', speed);
	// 				return null;
	// 			}
	// 		});
	// }
};
