'use strict';

const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');
const AppDirectory = require('appdirectory');
const dirs = new AppDirectory('miio');

const CHECK_TIME = 1000;
const MAX_STALE_TIME = 120000;

const debug = require('debug')('miio:automations');

/**
 * Shared storage for automation capability configs. of devices. 
 * 
 */
class Automations {
	constructor() {
		this._file = path.join(dirs.userData(), 'automations.json');
		this._data = {};
		this._lastSync = 0;
		this._loadedCfgName = {};
	}

	get(deviceId, cfgName) {
		const now = Date.now();
		const diff = now - this._lastSync;

		if(diff > CHECK_TIME) {
			return this._loadAndGet(deviceId, cfgName);
		}

		return Promise.resolve(this._get(deviceId, cfgName));
	}

	_get(deviceId, cfgName) {
		if(!this._data[deviceId]){
			this._data[deviceId] = {}; 
		}
		return this._data[deviceId][cfgName];
	}

	_loadAndGet(deviceId, cfgName) {
		return this._load()
			.then(() => this._get(deviceId, cfgName))
			.catch(() => null);
	}

	_load() {
		if(this._loading) return this._loading;

		return this._loading = new Promise((resolve, reject) => {
			debug('Loading automation config. storage from', this._file);
			fs.stat(this._file, (err, stat) => {
				if(err) {
					delete this._loading;
					if(err.code === 'ENOENT') {
						debug('Automation config. storage does not exist');
						this._lastSync = Date.now();
						resolve(this._data);
					} else {
						reject(err);
					}

					return;
				}

				if(! stat.isFile()) {
					// automations.json does not exist
					delete this._loading;
					reject(new Error('automations.json exists but is not a file'));
				} else if(Date.now() - this._lastSync > MAX_STALE_TIME || stat.mtime.getTime() > this._lastSync) {
					debug('Loading automations');
					fs.readFile(this._file, (err, result) =>  {
						this._data = JSON.parse(result.toString());
						this._lastSync = Date.now();
						delete this._loading;
						resolve(this._data);
					});
				} else {
					delete this._loading;
					this._lastSync = Date.now();
					resolve(this._data);
				}
			});
		});
	}

	update(deviceId, cfgName, cfg) { 
		return this._load()
			.then(() => {
				if(!this._data[deviceId]){
					this._data[deviceId] = {}; 
				}
				this._data[deviceId][cfgName] = cfg;

				if(this._saving) {
					this._dirty = true;
					return this._saving;
				}

				return this._saving = new Promise((resolve, reject) => {
					const save = () => {
						debug('About to save automations'); console.log('---- > saved automations:'+ cfgName);
						fs.writeFile(this._file, JSON.stringify(this._data, null, 2), (err) => {
							if(err) {
								reject(err);
							} else {
								if(this._dirty) {
									debug('Redoing save due to multiple updates');
									this._dirty = false;
									save();
								} else {
									delete this._saving;
									resolve();
								}
							}
						});
					};

					mkdirp(dirs.userData(), (err) => {
						if(err) {
							reject(err);
							return;
						}

						save();
					});
				});
			});
	}
}

module.exports = new Automations();
