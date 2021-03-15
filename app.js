/*jslint node: true */
'use strict';
if (process.env.DEBUG === '1') {
	require('inspector').open(9222, '0.0.0.0', true)
}

const SomaConnectApp = require( './lib/SomaConnectApp' );
module.exports = SomaConnectApp;