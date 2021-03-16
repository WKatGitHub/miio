'use strict';
const isDeepEqual = require('deep-equal');
const { Thing, State } = require('abstract-things');
const { boolean } = require('abstract-things/values');

module.exports = Thing.mixin(Parent => class extends Parent.with(State) {
	static get capability() {
		return 'miio:automation';
	}

    constructor(automation) {
        super(automation);

        this._automation = {
            enabled: false,
            cfg: {
                sensor: 'aqi',
                sensorMin: 0, 
                sensorMax: 999,
                pauseTime: 30, // 30 min.
                swPointDelta: 0, // additional switching hysteresis
                swOnPoint: 25, // hysteresis
                swPoints: [ // All points has condition: ">".
                    {value: 0, mode: 'idle'}, // power off
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
            },
            swUpPoint: 25,
            swDownPoint: 11,
            swCmd: {},
            pauseEndTime: null,
            status: 'ready' // 'paused...' / 'busy' / 'error' / 'disabled'
        }

    }  
    /**
	 * Get or set if the automation is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch automation to.
	 */
    automation(active){ //set or get automation state
        if(active === undefined){ 
            if(this._automation.pauseEndTime) {  
                let pauseTimeout = this._automation.pauseEndTime - Date.now();
                if(pauseTimeout > 0){
                    return {automation: 'paused for '+ Math.ceil(pauseTimeout/60000) +'m'};
                }
            }
            return {automation: this._automation.enabled};
        }
        if(this._automation.pauseEndTime){ // turn off automation pause;
            this._automation.pauseEndTime = null;
        }
        return {automation: this._automation.enabled = boolean(active)};
    }

    autocfg(cfg){ // set or get automation cfg object
        if(cfg === undefined){ 
            return {autocfg: this._automation.cfg}; // return config
        }
        if(!isDeepEqual(cfg, this._automation.cfg)){
            this._automation.cfg = cfg; // save new automation config.
            this._automation.swUpPoint = 0; // update swUpPoint & swDownPoint at next doAutomation() run
        } 
        return true;
    }

    doAutomation(sensor){ 
        let a = this._automation, p = this.properties;

        if(sensor === undefined){ // use internal sensor 
            sensor = p[a.cfg.sensor];   
        } else if(sensor < a.cfg.sensorMin || sensor > a.cfg.sensorMax){     // do przetestowania
            return {error: 'Automation > Error: Invalid sensor value `'+ sensor +'`'};
        } 
        let payload = {};
        if(a.enabled){
            if(a.status !== 'busy'){
                // Check if there was any manual switching. If yes, pause automation mode, for time = pauseTime.
                for(let key in a.swCmd){
                    if(p[key] !== undefined && a.swCmd[key] !== p[key]){
                        if(a.status !== 'error'){
                            if(a.swUpPoint && a.swCmd[key]){
                                a.pauseEndTime = Date.now() + a.cfg.pauseTime * 60000;
                                a.swUpPoint = 0; // update swUpPoint & swDownPoint after pause time ends
                            }
                            a.swCmd[key]= p[key];
                            payload[key]= p[key];
                        }
                    }
                }
                if(a.pauseEndTime){  
                    let pauseTimeout = a.pauseEndTime - Date.now();
                    if(pauseTimeout > 0){
                        payload.automation = 'paused for '+ Math.ceil(pauseTimeout/60000) +'m';
                        return payload;
                    } else {
                        a.pauseEndTime = null;
                    }
                }  
                if((sensor < a.swDownPoint)||(sensor > a.swUpPoint)){ 
                    a.status = 'busy';       
                    let maxIndex = a.cfg.swPoints.length -1;
                    for(let i = maxIndex; i > -1; i--){
                        let swPoint = a.cfg.swPoints[i];
                        if(sensor > swPoint.value){
                            for(let key in swPoint){ // save switching commands state
                                if(key !== 'value'){
                                    a.swCmd[key]= swPoint[key];
                                } 
                            }
                            a.swDownPoint = swPoint.value - a.cfg.swPointDelta;
                            if(i === 0){
                                a.swUpPoint = a.cfg.swOnPoint;
                            } else if(i === maxIndex) {
                                a.swUpPoint = a.cfg.sensorMax + 1;
                            } else {
                                a.swUpPoint = a.cfg.swPoints[i+1].value + a.cfg.swPointDelta;
                            } break;
                        }
                    }
                }
                if(a.status !== 'ready'){
                    return (async ()=>{
                        try{
                            for(let key in a.swCmd){
                                if(p[key] !== undefined && a.swCmd[key] !== p[key]){
                                    payload[key] = await this[key](a.swCmd[key]);
                                }
                            }
                            a.status = 'ready';
                            payload.automation = a.status;
                            return payload;
                        }catch(err){
                            a.status = 'error';
                            return {error: 'Automation > '+ err};
                        }
                    })();
                } // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            } 
            payload.automation = a.status;
            return payload;
        } else {
            payload.automation = 'disabled';
            return payload;
        }
    }
})