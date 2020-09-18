'use strict';
if (process.env.DEBUG === '1') {
	require('inspector').open(9222, '0.0.0.0', false)
}

const SomaConnectApp = require( './lib/SomaConnectApp' );
//require('inspector').open(9229, '0.0.0.0');
module.exports = SomaConnectApp;