'use strict';

const { AirPurifier } = require('abstract-things/climate');
const MiioApi = require('../device');

const Power = require('./capabilities/power');
const Mode = require('./capabilities/mode');
const FanSpeedLevel = require('./capabilities/fan-speed-level');
//const FavoriteLevel = require('./capabilities/favorite-level');
const LEDBrightness = require('./capabilities/changeable-led-brightness');
const Buzzer = require('./capabilities/buzzer');
const ChildLock = require('./capabilities/child-lock');
const Automation = require('./capabilities/automation');
const { Temperature, Humidity, AQI } = require('./capabilities/sensor');

const MAX_RPM = 2100;
const RPM_LEVELS = [350,700,750,800,850,1100,1150,1200,1400,1500,1700,1800,1900,1950,2000,2050,2100]; // 17 levels of motor speed in rpm
const FAN_SPEED_LEVELS = [17,33,36,38,40,52,55,57,67,71,81,86,91,93,95,97,100]; // fan speed levels in %
const MODES = ['idle','auto','silent','favorite'];
// default automation config
const AUTO_CFG = {
	name: 'default',
	sensor: 'aqi',
	sensorMin: 0, 
	sensorMax: 999,
	pauseTime: 30, // 30 min.
	swPointDelta: 0, // additional switching hysteresis
	swOnPoint: 25, // hysteresis
	swPoints: [ // All points has condition: ">".
		{value: 0, power: false},
		{value: 11, fanSpeedLevel: 1, mode: 'favorite', power: true}, 
		{value: 25, fanSpeedLevel: 2, mode: 'favorite', power: true},
		{value: 50, fanSpeedLevel: 3, mode: 'favorite', power: true},
		{value: 75, fanSpeedLevel: 4, mode: 'favorite', power: true},
		{value: 100, fanSpeedLevel: 5, mode: 'favorite', power: true},
		{value: 125, fanSpeedLevel: 6, mode: 'favorite', power: true},
		{value: 150, fanSpeedLevel: 7, mode: 'favorite', power: true},
		{value: 175, fanSpeedLevel: 8, mode: 'favorite', power: true},
		{value: 200, fanSpeedLevel: 9, mode: 'favorite', power: true},
		{value: 225, fanSpeedLevel: 10, mode: 'favorite', power: true},
		{value: 250, fanSpeedLevel: 11, mode: 'favorite', power: true},
		{value: 275, fanSpeedLevel: 12, mode: 'favorite', power: true},
		{value: 300, fanSpeedLevel: 13, mode: 'favorite', power: true},
		{value: 325, fanSpeedLevel: 14, mode: 'favorite', power: true},
		{value: 350, fanSpeedLevel: 15, mode: 'favorite', power: true},
		{value: 375, fanSpeedLevel: 16, mode: 'favorite', power: true}
	]
};

/**
 * Abstraction over a Mi Air Purifier.
 *
 * Air Purifiers have a mode that indicates if is on or not. Changing the mode
 * to `idle` will power off the device, all other modes will power on the
 * device.
 */
module.exports = class extends AirPurifier
	.with(MiioApi, Power, Mode, Temperature, Humidity, AQI, FanSpeedLevel, //FavoriteLevel,
		  LEDBrightness, Buzzer, ChildLock, Automation)
{

	static get type() {
		return 'miio:air-purifier-2';
	}

	constructor(options) {
		super(options);

		// automation config
		this._automation.cfg = AUTO_CFG;

		// Define the power property
		this.defineProperty('power', v => v === 'on');

		// Set the mode property and supported modes
		this.defineProperty('mode');
		this.updateModes(MODES);

		// Sensor value used for AQI (PM2.5) capability
		this.defineProperty('aqi');

		// Sensor value for Temperature capability
		this.defineProperty('temp_dec', {
			name: 'temperature',
			mapper: v => v / 10.0
		});

		// Sensor value for RelativeHumidity capability
		this.defineProperty('humidity');		

		// Info about usage
		this.defineProperty('filter1_life', {
			name: 'filterLifeRemaining'
		});
		this.defineProperty('f1_hour_used', {
			name: 'filterHoursUsed'
		});

		// Amount of purified air in cubic meters
		this.defineProperty('purify_volume', {
			name: 'purifyVolume'
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
			name: 'fanSpeed',
			mapper: v => {
				let p = this.properties;
				if (p.power !== undefined && p.power === false) {
					v = 0;
				} else if(p.mode === 'favorite') { 
					v = FAN_SPEED_LEVELS[p.fanSpeedLevel];
				} else {
					v = Math.round(v / MAX_RPM * 100); // motor speed in %
				}
				return v;
			}
		});

		// The fan speed level [0-16]
		this.defineProperty('favorite_level', {
			name: 'fanSpeedLevel'
		});

		// // The favorite level
		// this.defineProperty('favorite_level', {
		// 	name: 'favoriteLevel'
		// });

		// The fan speed in %
		// this.defineProperty('favorite_level', {
		// 	name: 'fanSpeed',
		// 	mapper: v => {
		// 		return Math.round( RPM_LEVELS[v] / MAX_RPM * 100);
		// 	}
		// });
	}

	changePower(power) {
		return this.call('set_power', [ power ? 'on' : 'off' ], {
			refresh: ['power', 'mode', 'fanSpeed'],
			refreshDelay: 200
		})
		.then((res) => { 
			if(MiioApi.checkOk(res) === null) {
				this.setProperty('power', power);
				if(!power){
					this.setProperty('mode','idle');
					this.setProperty('fanSpeed', 0);
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
		let arg = MODES.indexOf(mode);

		if(arg === -1){
			return Promise.reject(new Error('Mode `' + mode + '` not supported'));
		}	

		return this.call('set_mode', [ mode ], {
			refresh: ['power', 'mode','fanSpeed'],
			refreshDelay: 200
		})	
		.then((res) => { 
			if(MiioApi.checkOk(res) === null) {
				this.setProperty('mode', mode);
				this.setProperty('power', mode === 'idle' ? false : true);
				return null;
			}
		});
	}

	changeBuzzer(active) {
		return this.call('set_buzzer', [ active ? 'on' : 'off' ])
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
		return this.call('set_led_b', [ arg ])
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('ledBrightness', level);
					return null;
				}
			});
	}

	changeChildLock(active) {
		return this.call('set_child_lock', [ active ? 'on' : 'off' ])
			.then((res) => { 
				if(MiioApi.checkOk(res) === null) {
					this.setProperty('childLock', active);
					return null;
				}
			});
	}

	changeFanSpeedLevel(level) {
		return this.call('set_level_favorite', [ level ], {
			refresh: ['fanSpeed']
		})
		.then((res) => { 
			if(MiioApi.checkOk(res) === null) {
				this.setProperty('fanSpeedLevel', level);
				return null;
			}
		});
	}

	// changeFavoriteLevel(level) {
	// 	return this.call('set_level_favorite', [ level ])
	// 	.then((res) => { 
	// 		if(MiioApi.checkOk(res) === null) {
	// 			this.setProperty('favoriteLevel', level);
	// 			return null;
	// 		}
	// 	});
	// }

	// changeFanSpeed(speed) { 
	// 	let arg= -1;
	// 	if(speed >= 0 && speed <= 100){
			
	// 		speed = MAX_RPM * speed / 100; // speed in rpm

	// 		for(let i=0; i<RPM_LEVELS.length-1; i++) {
	// 			if(Math.abs(speed - RPM_LEVELS[i]) <= Math.abs(speed - RPM_LEVELS[i+1])){
	// 				arg = i;
	// 				break;
	// 			}
	// 		}
	// 		if(arg === -1){
	// 			arg = RPM_LEVELS.length-1; 
	// 		}
	// 		speed = Math.round(RPM_LEVELS[arg] / MAX_RPM * 100);

	// 	} else {
	// 		return Promise.reject(new Error('Invalid Fan Speed: `'+ speed +'`'));
	// 	}
	// 	return this.call('set_level_favorite', [ arg ])
	// 		.then((res) => { 
	// 			if(MiioApi.checkOk(res) === null) {
	// 				this.setProperty('fanSpeed', speed);
	// 				return null;
	// 			}
	// 		});
	// }
};
