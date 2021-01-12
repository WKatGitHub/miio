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
                pauseTime: 30, // 30 min.
                swPointDelta: 0, // additional switching hysteresis
                swOnPoint: 25, // hysteresis
                swPoints: [ // All points has condition: ">".
                    {value: 0, mode: 'idle'},
                    {value: 11, mode: 'favorite', fanSpeed: 1}, 
                    {value: 25, mode: 'favorite', fanSpeed: 2},
                    {value: 50, mode: 'favorite', fanSpeed: 3},
                    {value: 75, mode: 'favorite', fanSpeed: 4},
                    {value: 100, mode: 'favorite', fanSpeed: 5},
                    {value: 125, mode: 'favorite', fanSpeed: 6},
                    {value: 150, mode: 'favorite', fanSpeed: 7},
                    {value: 175, mode: 'favorite', fanSpeed: 8},
                    {value: 200, mode: 'favorite', fanSpeed: 9},
                    {value: 225, mode: 'favorite', fanSpeed: 10},
                    {value: 250, mode: 'favorite', fanSpeed: 11},
                    {value: 275, mode: 'favorite', fanSpeed: 12},
                    {value: 300, mode: 'favorite', fanSpeed: 13},
                    {value: 325, mode: 'favorite', fanSpeed: 14},
                    {value: 350, mode: 'favorite', fanSpeed: 15},
                    {value: 375, mode: 'favorite', fanSpeed: 16},
                    {value: 400, mode: 'auto'}
                ]
            },
            swUpPoint: 25,
            swDownPoint: 11,
            swMode: null,
            swFanSpeed: null,
            pauseEndTime: null,
            status: 'ready' // 'paused...' / 'busy' / 'error' / 'disabled'
        }
    }  
    /**
	 * Get or set if the buzzer is active.
	 *
	 * @param {boolean} active
	 *   Optional boolean to switch buzzer to.
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

    doAutomation(aqi){
        if(aqi === undefined){ // use internal aqi sensor 
            aqi = this.properties.aqi;
        } else if(aqi < 0 || aqi > 999){
            return {error: 'Automation > Error: Invalid aqi value `'+ aqi +'`'};
        } 
        let payload = {};
        if(this._automation.enabled){
            let a = this._automation, p = this.properties;
            if(a.status !== 'busy'){
                // Check if there was any manual switching. If yes, pause automation mode, for time = pauseTime.
                if(a.swMode !== p.mode || a.swFanSpeed && (a.swFanSpeed !== p.favoriteLevel)){ 
                    if(a.status !== 'error'){
                        if(a.swMode){
                            a.pauseEndTime = Date.now() + a.cfg.pauseTime * 60000;
                        }
                        a.swMode = p.mode;
                        a.swFanSpeed = p.favoriteLevel;
                        a.swUpPoint = 0; // update swUpPoint & swDownPoint after pause time ends
                        payload.mode = p.mode;
                        payload.favoriteLevel = p.favoriteLevel;
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
                if ((aqi < a.swDownPoint)||(aqi > a.swUpPoint)){
                    a.status = 'busy';       
                    let maxIndex = a.cfg.swPoints.length -1;
                    for(let i = maxIndex; i > -1; i--){
                        let swPoint = a.cfg.swPoints[i];
                        if(aqi > swPoint.value){
                            a.swMode = swPoint.mode;
                            a.swFanSpeed= swPoint.fanSpeed;
                            a.swDownPoint = swPoint.value - a.cfg.swPointDelta;
                            if(i === 0){
                                a.swUpPoint = a.cfg.swOnPoint;
                            } else if(i === maxIndex) {
                                a.swUpPoint = 1000;
                            } else {
                                a.swUpPoint = a.cfg.swPoints[i+1].value + a.cfg.swPointDelta;
                            } break;
                        }
                    }
                }
                if(a.status !== 'ready'){
                    return (async ()=>{
                        try{
                            if(a.swMode !== p.mode){
                                payload.mode = await this.mode(a.swMode);
                            }
                            if(a.swMode === 'favorite' && a.swFanSpeed !== p.favoriteLevel){
                                payload.favoriteLevel = await this.favoriteLevel(a.swFanSpeed);
                            }
                            a.status = 'ready';
                            payload.automation = a.status;
                            return payload;
                        }catch(err){
                            a.status = 'error';
                            return {error: 'Automation > '+ err};
                        }
                    })();
                }
            } 
            payload.automation = a.status;
            return payload;
        } else {
            payload.automation = 'disabled';
            return payload;
        }
    }
})