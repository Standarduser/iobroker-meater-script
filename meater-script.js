//=======================================================================
// Einstellungen
var username = "<email@adresse>";
var password = "<passwort>";
var language = "de";
var update_idle = 20 //Sekunden (derzeit noch nicht genutzt)
var update_cook = 2  //Sekunden (derzeit noch nicht genutzt)

var meater_url = 'https://public-api.cloud.meater.com/v1/devices'
var meater_url_login = 'https://public-api.cloud.meater.com/v1/login'

var data_path = '0_userdata.0.Meater';

// Ende Einstellungen
//=======================================================================

var rawData = data_path + '.rawData';
var path = new Array();
var states = new Array();
var token = '';

//Daten lesen
function readData(json){

    //JSON auseinandernehmen
    for(var key in json){

        console.debug('readData: Bearbeite folgenden Key: ' + key);

        //Key speichern, für den fall, dass Value ein Object ist und die Keys verkettet werden müssen
        path.push(key);
        console.debug('readData: Datenpunktpfad: ' + path);

        if(typeof json[key] == 'object'){
            //Value ist ein Object -> weiter auseinandernehmen
            console.debug('readData: Typ == object');
            readData(json[key]);
        } else {
            //Value ist ein echter Wert
            console.debug('readData: Datenpunkt ist ein Value');
            var state = data_path + '.' + path.join('.');   // Datenpunktname (vollständig)
            var value = json[key];                          // Wert

            //Datenpunkt schreiben
            if(!existsState(state)) {
                console.debug('readData: Datenpunkt existiert noch nicht, lege ihn an: ' + state)
                createState(state, value);
            } else {
                setState(state, value, true);
                console.debug('readData: setze Datenpunkt: ' + state + " --> " + value);
            }

            //Datenpunkt aus dem Array existierender Datenpunkte entfernen, da Wert aktualisiert wurde
            const index = states.indexOf(state);
            if (index > -1) {               //Array nur bearbeiten, wenn der State gefunden wurde
                states.splice(index, 1);    //State aus Array entfernen
                console.debug('readData: State aus Array entfernt');
                console.debug('readData: Anzahl states: ' + states.length);
            }
        }
        //Pfad nach Bearbeitung des aktuellen Keys wiederherstellen
        path.pop();
    }
}

//Login
function login() {
    var request = require('request');
    request.post({
        headers: {"content-type" : "application/json"},
        url:     meater_url_login,
        json:    {"email": username, "password": password}
    }, function(error, response, result){
        console.log('login: Login wurde mit folgendem Ergebnis ausgeführt:');
        console.log('login: ' + result);

        //Die Antwort ist nicht im richtigen JSON-Format
        result = JSON.stringify(result);

        //Rohdaten speichern
        if(!existsState(rawData)) {createState(rawData, result);} else {setState(rawData, result, true);}

        //Daten verarbeiten
        readData(JSON.parse(result));
    });
}

//Daten aus der Cloud lesen
function readFromCloud() {

    //Token ermitteln
    if (!existsState(data_path + '.data.token') || (getState('0_userdata.0.Meater.data.token').val) == '') {
        console.log('readFromCloud: Kein Token vorhanden --> Login ausführen')
        login();
    //Daten abrufen
    } else {
        token = getState('0_userdata.0.Meater.data.token').val;
        console.debug('readFromCloud: Rufe Daten aus der Cloud ab')

        var request = require('request');
        request.get({
            headers: {"Authorization": "Bearer " + token, "Accept-Language": language},
            url:     meater_url
        }, function(error, response, result){
            console.debug('readFromCloud: Daten wurden abgerufen und lieferten folgendes Ergebnis:')
            console.log('readFromCloud: ' + result);
            console.debug('readFromCloud: Der Statuscode lautet ' + JSON.parse(result).statusCode);

            //alle existierenden States einsammeln
            var existingStates = Array.prototype.slice.apply($("state[id=" + data_path + "*]"));
            for (var state in existingStates) {
                states.push(existingStates[state]);
            }
            console.debug('readFromCloud: Folgende States sind vorhanden: ' + states);
            console.debug('readFromCloud: Anzahl states: ' + states.length);

            //Rohdaten speichern
            if(!existsState(rawData)) {createState(rawData, result);} else {setState(rawData, result, true);}

            //aus der Cloud abgerufene Daten in die States schreiben
            readData(JSON.parse(result));

            //Statuscode auswerten
            var statusCode = JSON.parse(result).statusCode;
            switch(statusCode) {
                case 200:   // OK
                    console.debug('readFromCloud: Statuscode 200 --> OK');
                    break;
                case 400:   // Bad Request
                    console.error('readFromCloud: Statuscode 400 --> Bad Request');
                    break;
                case 401:   // Unauthorized
                    console.log('readFromCloud: Statuscode 401 --> Unauthorized --> Login nötig');
                    login();
                    break;
                case 404:   // Not Found
                    console.warn('readFromCloud: Statuscode 404 --> Not Found');
                    break;
                case 429:   // Too Many Requests
                    console.warn('readFromCloud: Statuscode 429 --> Too Many Requests');
                    break;
                case 500:   // Internal Server Error
                    console.warn('readFromCloud: Statuscode 500 --> Internal Server Error');
                    break;
            }

            console.debug('readFromCloud: Nach Abruf der Daten aus der Cloud sind folgende States NICHT aktualisiert worden: ' + states);
            console.debug('readFromCloud: Anzahl states: ' + states.length);

            //Alle Datenpunkte leeren, für die keine neuen Werte empfangen wurden
            //außer den Token und userId
            //(Aktualisierte Datenpunkte werden bei mit der Funktion getData aus dem Array entfernt.)
            for (var state in states) {
                //console.log('State leeren > ' + states[state]);
                if (states[state].includes('token') || states[state].includes('userId') || states[state].includes('rawData')) {
                    // do nothing
                } else if (states[state].includes('cook.name')) {
                    setState(states[state], 'Meater', true);
                } else {
                    setState(states[state], '', true);
                    //console.log('State geleert');
                }
            }

            //States leeren
            states = [];
        });
    }
}

var meaterIdle, meaterCook;
var Intervall;

Intervall = setInterval(async function () {
  readFromCloud();
}, 5000);

readFromCloud();
