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
const {AQI} = require('./capabilities/sensor');

const MAX_RPM = 2200;
const FAN_SPEED_LEVELS = [16,32,34,36,39,50,52,55,59,63,68,73,77,82,86,91,100];
const RPM_LEVELS = [350,700,750,800,850,1100,1150,1200,1300,1400,1500,1600,1700,1800,1900,2000,2200]; // 17 levels of motor speed in rpm
const MODES = ['auto','silent','favorite'];
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
	.with(MiioApi, Power, Mode, AQI, FanSpeedLevel, //FavoriteLevel, //FanSpeed,
		  LEDBrightness, Buzzer, ChildLock, Automation)
{

	static get type() {
		return 'miio:air-purifier-3';
	}

	constructor(options) {
		super(options);

		// automation config
		this._automation.cfg = AUTO_CFG;

		// Define the power property
		this.defineProperty({did: 'power', siid: 2, piid: 1});

		// Set the mode property and supported modes
		this.defineProperty({did: 'mode', siid: 2, piid: 4}, {
			mapper: v => {
				return MODES[v] ? MODES[v] : 'unknown';
			}
		});
		this.updateModes(MODES);
		
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
		this.defineProperty({did: 'favoriteRpm', siid: 9, piid: 3}, {
			name: 'fanSpeedLevel',
			mapper: v => {
				if(RPM_LEVELS.indexOf(v) !== -1){
					v = RPM_LEVELS.indexOf(v);
				} else { // return the closest level value
					let maxLevel = RPM_LEVELS.length - 1;
					for(let i=0; i< maxLevel; i++) {
						if(Math.abs(v - RPM_LEVELS[i]) <= Math.abs(v - RPM_LEVELS[i+1])){
							v = i;
							break;
						}
					}
					if(v > maxLevel){
						v = maxLevel;
					}
				}
				return v;
			}
		});

		// // The favorite level
		// this.defineProperty({did: 'favoriteRpm', siid: 9, piid: 3}, {
		// 	name: 'favoriteLevel',
		// 	mapper: v => {
		// 		if(RPM_LEVELS.indexOf(v) !== -1){
		// 			return RPM_LEVELS.indexOf(v);
		// 		} else { // return the closest level value
		// 			for(let i=0; i<RPM_LEVELS.length - 1; i++) {
		// 				if(Math.abs(v - RPM_LEVELS[i]) <= Math.abs(v - RPM_LEVELS[i+1])){
		// 					v = i;
		// 					break;
		// 				}
		// 			}
		// 			if(v > maxLevel){
		// 				v = maxLevel;
		// 			}
		// 		}
		// 	}
		// });

		// // The fan speed in %
		// this.defineProperty({did: 'favoriteRpm', siid: 9, piid: 3}, {
		// 	name: 'fanSpeed',
		// 	mapper: v => {
		// 		return Math.round( v / MAX_RPM * 100);
		// 	}
		// });

	}

	changePower(power) {
		return this.call('set_properties', [{did: 'power', siid: 2, piid: 1, "value": power ? true : false }], {
			refresh: ['power', 'mode','fanSpeed'],
			refreshDelay: 200
		})
		.then((res) => { 
			if(MiioApi.checkCode0(res) === null) {
				this.setProperty('power', power);
				if(!power){
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

		return this.call('set_properties', [{did: 'mode', siid: 2, piid: 4, "value": arg }], {
			refresh: ['power', 'mode','fanSpeed'],
			refreshDelay: 200
		})
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

	changeFanSpeedLevel(level) {
		return this.call('set_properties', [{did: 'favoriteRpm', siid: 9, piid: 3, value: RPM_LEVELS[level]}], {
			refresh: ['fanSpeed']
		})
		.then((res) => { 
			if(MiioApi.checkCode0(res) === null) {
				this.setProperty('fanSpeedLevel', level);
				this.setProperty('power', true);
				this.setProperty('mode', 'favorite');
				return null;
			}
		});
	}

	// changeFavoriteLevel(level) {
	// 	return this.call('set_properties', [{did: 'favoriteRpm', siid: 9, piid: 3, value: RPM_LEVELS[level]}])
	// 	.then((res) => { 
	// 		if(MiioApi.checkCode0(res) === null) {
	// 			this.setProperty('favoriteLevel', level);
	// 			this.setProperty('power', true);
	// 			this.setProperty('mode', 'favorite');
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
	// 				arg = RPM_LEVELS[i];
	// 				break;
	// 			}
	// 		}
	// 		if(arg === -1){
	// 			arg = MAX_RPM;
	// 		}
	// 		speed = Math.round(arg / MAX_RPM * 100);

	// 	} else {
	// 		return Promise.reject(new Error('Invalid Fan Speed: `'+ speed +'`'));
	// 	}
	// 	return this.call('set_properties', [{did: 'favoriteRpm', siid: 9, piid: 3, value: arg}])
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
