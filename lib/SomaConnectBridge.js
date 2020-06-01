'use strict';

const Homey = require( 'homey' );
//const { EventEmitter } = require( 'events' );
const fetch = require( 'node-fetch' );

module.exports = class SomaConnectBridge
{
    constructor()
    {
        //super();
        return this;
    }

    async getDevices()
    {
        const devices = [];
        try
        {
            const somaDevices = await this.sendMessage( 'get', 'list_devices' );
            if ( somaDevices != -1 )
            {
                for ( const device of somaDevices[ 'shades' ] )
                {
                    var iconName = "venetianblind.svg";
                    var data = {};
                    data = {
                        "id": device[ 'mac' ],
                    };
                    devices.push(
                    {
                        "name": device[ 'name' ],
                        "icon": iconName,
                        data
                    } )
                }
                return devices;
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( "Failed to get Devices from the Hub" );

        }

        return "";
    }

    async setPosition( mac, position )
    {
        if ( typeof mac != 'string' )
        {
           //console.log( "setPosition", mac, typeof mac );
            return "";
        }

        var result = "";
        const body = '';
        //console.log( 'setPosition: ', position );

        result = await this.sendMessage( 'get', 'set_shade_position/' + mac + '/' + position );

        // Refresh GUI after 15 seconds regardless of polling options
        Homey.app.setPollTime( 15, true );
        return result;
    }

    async getPosition( mac )
    {
        if ( typeof mac != 'string' )
        {
            //console.log( "getPosition", mac, typeof mac );
            return "";
        }

        var result = "";

        result = await this.sendMessage( 'get', 'get_shade_state/' + mac );
        if ( result != -1 )
        {
            return result[ 'position' ];
        }

        return -1;
    }

    async getBattery( mac )
    {
        if ( typeof mac != 'string' )
        {
            //console.log( "getBattery", mac, typeof mac );
            return "";
        }

        var result = "";

        result = await this.sendMessage( 'get', 'get_battery_level/' + mac );
        if ( result != -1 )
        {
            return result[ 'battery_level' ];
        }

        return -1;
    }

    async sendMessage( method, path )
    {
        var errMsg = "";
        //console.log( 'sendMessage: ', method, path);
        try
        {
            if (Homey.ManagerSettings.get( 'hubIP' ) == "")
            {
                return -1;
            }
            const hubIP = Homey.ManagerSettings.get( 'hubIP' ) + ":3000/";
            const connectResult = await this._call(
            {
                method: method,
                address: hubIP,
                path: path,
                body: "",
            } );

            //console.log('sendMessage Result: ', connectResult);
            if ( connectResult )
            {
                return connectResult;
            }
        }
        catch ( err )
        {
            Homey.app.updateLog( "Connection Failed: " + err );

            errMsg = err.message.toLowerCase();
        }

        return -1;

    }

    async _call(
    {
        address,
        method = 'get',
        path = '/',
        body,
    } )
    {
        if ( !address )
        {
            throw new Error( 'Missing URL' );
        }

        const url = `http://${address}${path}`;
        const opts = {
            method,
            headers:
            {
                'content-type': 'application/json',
            },
        }

        const res = await fetch( url, opts );

        var bodyText;
        if ( res.status === 200 )
        {
            // Get the reply in JSON format
            bodyText = await res.json();
        }
        else
        {
            // Get the reply as text as it will possibly be an error message
            bodyText = await res.text();
        }

        // Make sure there is something to return and the status was good
        if ( bodyText && ( res.status === 200 ) )
        {
            return bodyText;
        }

        if ( !res.ok )
        {
            // The result was bad so throw an error
            // console.log('status: ', res.status);
            const err = new Error( ( bodyText && bodyText.error && bodyText.error.message ) || ( bodyText ) || 'Unknown Error' );
            err.code = res.status;
            throw err;
        }

        return bodyText;
    }
}