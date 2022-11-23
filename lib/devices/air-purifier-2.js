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

const MAX_RPM = 2100;
//const RPM_LEVELS = [350,700,750,800,850,1100,1150,1200,1400,1500,1700,1800,1900,1950,2000,2050,2100]; // 17 levels of motor speed in rpm
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
		{value: 0, mode: 'idle'},
		{value: 11, mode: 'favorite', favoriteLevel: 1}, 
		{value: 25, mode: 'favorite', favoriteLevel: 2},
		{value: 50, mode: 'favorite', favoriteLevel: 3},
		{value: 75, mode: 'favorite', favoriteLevel: 4},
		{value: 100, mode: 'favorite', favoriteLevel: 5},
		{value: 125, mode: 'favorite', favoriteLevel: 6},
		{value: 150, mode: 'favorite', favoriteLevel: 7},
		{value: 175, mode: 'favorite', favoriteLevel: 8},
		{value: 200, mode: 'favorite', favoriteLevel: 9},
		{value: 225, mode: 'favorite', favoriteLevel: 10},
		{value: 250, mode: 'favorite', favoriteLevel: 11},
		{value: 275, mode: 'favorite', favoriteLevel: 12},
		{value: 300, mode: 'favorite', favoriteLevel: 13},
		{value: 325, mode: 'favorite', favoriteLevel: 14},
		{value: 350, mode: 'favorite', favoriteLevel: 15},
		{value: 375, mode: 'favorite', favoriteLevel: 16},
		{value: 400, mode: 'auto'}
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
	.with(MiioApi, Power, Mode, FavoriteLevel, Temperature, Humidity, AQI, //FanSpeed,
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
			name: 'motorSpeed',
			mapper: v => Math.round(v / MAX_RPM * 100) // motor speed in %
		});

		// The favorite level
		this.defineProperty('favorite_level', {
			name: 'favoriteLevel'
		});

		// // The fan speed in %
		// this.defineProperty('favorite_level', {
		// 	name: 'fanSpeed',
		// 	mapper: v => {
		// 		return Math.round( RPM_LEVELS[v] / MAX_RPM * 100);
		// 	}
		// });
	}

	changePower(power) {
		return this.call('set_power', [ power ? 'on' : 'off' ], {
			refresh: ['motorSpeed'],
			refreshDelay: 2000
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
		let arg = MODES.indexOf(mode);

		if(arg === -1){
			return Promise.reject(new Error('Mode `' + mode + '` not supported'));
		}	

		return this.call('set_mode', [ mode ], {
			refresh: ['motorSpeed'],
			refreshDelay: 2000
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

	changeFavoriteLevel(level) {
		return this.call('set_level_favorite', [ level ], {
			refresh: ['motorSpeed'],
			refreshDelay: 2000
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
