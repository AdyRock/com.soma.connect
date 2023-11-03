/*jslint node: true */
'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( './SomaConnectBridge' );
const { getSunrise, getSunset } = require('sunrise-sunset-js');

const POLL_INTERVAL = 30000;
class SomaConnectApp extends Homey.App
{
    async onInit()
    {
        this.homey.settings.set( 'diagLog', "Starting app\r\n" );

        this.Bridges = [];
        this.mDNSBridges = this.homey.settings.get( 'Bridges' );
        if ( !this.mDNSBridges )
        {
            // No bridges have been discovered have
            this.mDNSBridges = [];
        }
        else
        {
            this.mDNSBridges.forEach( element =>
            {
                let bridge = new SomaConnectBridge( this.homey, element.address, element.bridgeId, element.bridgeUSB );
                this.Bridges.push( bridge );
            } );
        }

        this.discoveryStrategy = this.homey.discovery.getStrategy( "soma_connect" );

        let results = this.discoveryStrategy.getDiscoveryResults();
        this.log( "Got mDNS result:", this.varToString(results) );
        if (results)
        {
            // Extract each bridge entry from the result object
            for (const bridge of Object.values(results))
            {
                this.mDNSBridgesUpdate( bridge );
            }
        }

        this.discoveryStrategy.on( "result", discoveryResult =>
        {
            this.log( "Got mDNS result:", this.varToString(discoveryResult) );
            this.mDNSBridgesUpdate( discoveryResult );
        } );

        this.discoveryStrategy.on('addressChanged', (discoveryResult) =>
        {
            if (this.infoLogEnabled)
            {
                this.logInformation(`Got mDNS address changed:${this.varToString(discoveryResult)}`);
            }
            this.mDNSBridgesUpdate(discoveryResult);
        });

        this.oldUsePolling = this.homey.settings.get( 'usePolling' );
        this.oldPollingInterval = this.homey.settings.get( 'pollInterval' );
        this.logEnabled = this.homey.settings.get( 'logEnabled' );

        // Make sure polling interval is set to something
        if ( !this.oldPollingInterval || ( this.oldPollingInterval < 1 ) || ( this.oldPollingInterval > 60000 ) )
        {
            this.homey.settings.set( 'pollInterval', POLL_INTERVAL );
            this.oldPollingInterval = this.homey.settings.get( 'pollInterval' );
        }

        this.homey.settings.on( 'set', function( setting )
        {
            if ( ( setting === 'usePolling' ) || ( setting === 'pollInterval' ) )
            {
                // usePolling or pollInterval has been changed
                this.homey.app.pollValues();
            }

            if ( setting === 'logEnabled' )
            {
                this.homey.app.logEnabled = this.homey.settings.get( 'logEnabled' );
            }
        } );

        this.longitude = this.homey.geolocation.getLongitude();
        this.latitude = this.homey.geolocation.getLatitude();

        this.pollValues = this.pollValues.bind( this );
        this.pollBattery = this.pollBattery.bind( this );
        this.pollLightLevel = this.pollLightLevel.bind( this );

        this.boostTimer = 0;
        this.timerPollBatteryID = null;
        this.timerPollLightID = null;

        this.setPollTime();
        this.pollBattery();
        this.homey.setTimeout( this.pollLightLevel, 15000 );

        this.updateLog( '************** Soma Connect app has initialised. ***************' );
    }

    async add_editBridge(bridgeId, bridgeIP, bridgeUSB)
    {
        await this.mDNSBridgesUpdate( { id: bridgeId, address: bridgeIP, type: bridgeUSB });
        return this.mDNSBridges;
    }

    async mDNSBridgesUpdate( discoveryResult )
    {
        const ip = discoveryResult.address;
        const id = discoveryResult.id;
        const type = discoveryResult.type;

        if ( !id )
        {
            return;
        }

        var entryIndex = -1;

        entryIndex = this.mDNSBridges.findIndex( ( bridge ) =>
        {
            return bridge.bridgeId === id;
        } );

        if (entryIndex >= 0)
        {
            if (!ip)
            {
                //delete the bridge
                this.mDNSBridges.splice(entryIndex, 1);
                entryIndex = this.Bridges.findIndex( ( bridge ) =>
                {
                    return bridge.bridgeId === id;
                } );

                if ( entryIndex >= 0 )
                {
                    this.Bridges.splice(entryIndex, 1);
                }
            }
            else
            {
                this.mDNSBridges[ entryIndex ].address = ip;
                let bridge = await this.getBridge( id );
                if ( bridge )
                {
                    bridge.ip = ip;
                    bridge.bridgeUSB = type;
                }
            }
        }
        else if (ip)
        {
            const bridge = {
                bridgeId: id,
                address: ip,
                bridgeUSB: type,
            };

            this.mDNSBridges.push( bridge );
            this.Bridges.push( new SomaConnectBridge( this.homey, ip, id, type ) );
        }

        this.homey.settings.set( 'Bridges', this.mDNSBridges );
    }

    async getBridge( id )
    {
        if ( this.Bridges )
        {
            let index = this.Bridges.findIndex( ( bridge ) =>
            {
                return bridge.bridgeId === id;
            } );

            if ( index >= 0 )
            {
                return this.Bridges[ index ];
            }
        }
        throw new Error( "Bridge not found" );
    }

    async getDevices()
    {
        let devices = [];
        if ( this.Bridges )
        {
            for ( const bridge of this.Bridges )
            {
                try
                {
                    const bridgeDevice = await bridge.getDevices()
                    devices = devices.concat( bridgeDevice );
                }
                catch ( err )
                {}
            }
        }

        return devices;
    }

    // Set the next poll inteval
    setPollTime( boostTime = 0 )
    {
        this.homey.clearTimeout( this.timerPollValuesID );
        if ( boostTime > 0 )
        {
            this.boostTimer = boostTime;
        }

        let pollTime = 30;
        if ( this.boostTimer > 0 )
        {
            this.boostTimer--;
            pollTime = 10;
        }
        else
        {
            pollTime = this.homey.settings.get( 'pollInterval' );
        }

        this.timerPollValuesID = this.homey.setTimeout( this.homey.app.pollValues, pollTime * 1000 );
    }

    async pollValues()
    {
        this.homey.clearTimeout( this.timerPollValuesID );

        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "\n*** Refreshing Values ***" );
        }

        const drivers = this.homey.drivers.getDrivers();
        for ( const driverId in drivers )
        {
            let driver = this.homey.drivers.getDriver( driverId );
            if ( driver.onPollValues )
            {
                try
                {
                    await driver.onPollValues();
                }
                catch ( err )
                {
                    this.homey.app.updateLog( "*** Refreshing Values Error ***\n" );
                }
            }
        }
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "*** Refreshing Values Finished ***\n" );
        }

        this.setPollTime();
    }

    async pollBattery()
    {
        this.homey.clearTimeout( this.timerPollBatteryID );

        const drivers = this.homey.drivers.getDrivers();
        for ( const driverId in drivers )
        {
            let driver = this.homey.drivers.getDriver( driverId );
            if ( driver.onPollBattery )
            {
                await driver.onPollBattery();
            }
        }

        this.timerPollBatteryID = this.homey.setTimeout( this.pollBattery, this.timerPollBatteryID === null ? 60000 : (60 * 60 * 1000) );
    }

    async pollLightLevel()
    {
        this.homey.clearTimeout( this.timerPollLightID );

        const sunset = getSunset(this.latitude, this.longitude);
        const sunrise = getSunrise(this.latitude, this.longitude);
        const now = new Date();

        if ((this.timerPollLightID === null) || ((now >= sunrise) && (now <= sunset)))
        {
            const drivers = this.homey.drivers.getDrivers();
            for ( const driverId in drivers )
            {
                let driver = this.homey.drivers.getDriver( driverId );
                if ( driver.onPollLightLevel )
                {
                    await driver.onPollLightLevel();
                }
            }
        }

        this.timerPollLightID = this.homey.setTimeout( this.pollLightLevel, 5 * 60 * 1000 );
    }

    updateLog( newMessage, force = false )
    {
        this.log( newMessage );

        var oldText = this.homey.settings.get( 'diagLog' );
        if ( oldText.length >= 10000 )
        {
            // Remove characters from the start to make space for the new text.
            let removeSize = ( oldText.length - 10000 ) + newMessage.length;
            oldText = oldText.substring( removeSize );
            var n = oldText.indexOf( "\n" );
            if ( n >= 0 )
            {
                // Remove up to and including the first \n so the log starts on a whole line
                oldText = oldText.substring( n + 1 );
            }
        }
        const nowTime = new Date(Date.now());

        oldText += '\r\n* ';
        oldText += nowTime.toJSON();
        oldText += '\r\n';

        oldText += "* ";
        oldText += newMessage;
        oldText += "\n";
        this.homey.settings.set( 'diagLog', oldText );
    }

    // Compare version strings of the format x.x.x where x is a number >= 0
    // returns -1 if v1 < v2, 0 if v1 == v2 and 1 if v1 > v2
    compareVersions( v1, v2 )
    {
        let vc1 = v1.split( '.' );
        let vc2 = v2.split( '.' );

        if ( parseInt( vc1[ 0 ] ) < parseInt( vc2[ 0 ] ) ) return -1;
        if ( parseInt( vc1[ 0 ] ) > parseInt( vc2[ 0 ] ) ) return 1;
        if ( parseInt( vc1[ 1 ] ) < parseInt( vc2[ 1 ] ) ) return -1;
        if ( parseInt( vc1[ 1 ] ) > parseInt( vc2[ 1 ] ) ) return 1;
        if ( parseInt( vc1[ 2 ] ) < parseInt( vc2[ 2 ] ) ) return -1;
        if ( parseInt( vc1[ 2 ] ) > parseInt( vc2[ 2 ] ) ) return 1;

        return 0;
    }


    varToString( source )
    {
        if ( source === null )
        {
            return "null";
        }
        if ( source === undefined )
        {
            return "undefined";
        }
        if ( source instanceof Error )
        {
            let stack = source.stack.replace( '/\\n/g', '\n' );
            return source.message + '\n' + stack;
        }
        if ( typeof( source ) === "object" )
        {
            return JSON.stringify( source, null, 2 );
        }
        if ( typeof( source ) === "string" )
        {
            return source;
        }

        return source.toString();
    }
}

module.exports = SomaConnectApp;