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

const path = [];
const states = [];
var token = '';

//Daten lesen
function readData(json){

    //JSON auseinandernehmen
    for(var key in json){

        //Key speichern, für den fall, dass Value ein Object ist und die Keys verkettet werden müssen
        path.push(key);

        if(typeof json[key] == 'object'){
            //Value ist ein Object -> weiter auseinandernehmen
            readData(json[key]);
        } else {
            //Value ist ein echter Wert
            var state = data_path + '.' + path.join('.');   // Datenpunktname (vollständig)
            var value = json[key];                          // Wert

            //Datenpunkt schreiben
            if(!existsState(state)) {
                createState(state, value);
            } else {
                setState(state, value, true);
            }

            //Datenpunkt aus dem Array existierender Datenpunkte entfernen, da Wert aktualisiert wurde
            const index = states.indexOf(state);
            if (index > -1) {               //Array nur bearbeiten, wenn der State gefunden wurde
                states.splice(index, 1);    //State aus Array entfernen
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
        console.log('Login wurde mit folgendem Ergebnis ausgeführt:');
        console.log(result);

        //Die Antwort ist nicht im richtigen JSON-Format
        result = JSON.stringify(result);
        readData(JSON.parse(result));
    });
}

//Daten aus der Cloud lesen
function readFromCloud() {

    //Token ermitteln
    if (!existsState(data_path + '.data.token') || (getState('0_userdata.0.Meater.data.token').val) == '') {
        console.log('Kein Token vorhanden --> Login ausführen')
        login();
    //Daten abrufen
    } else {
        token = getState('0_userdata.0.Meater.data.token').val;
        console.log('Rufe Daten aus der Cloud ab')

        var request = require('request');
        request.get({
            headers: {"Authorization": "Bearer " + token, "Accept-Language": language},
            url:     meater_url
        }, function(error, response, result){
            console.log('Daten wurden abgerufen und lieferten folgendes Ergebnis:')
            console.log(result);
            console.log('Der Statuscode lautet ' + JSON.parse(result).statusCode);

            //alle existierenden States einsammeln
            var existingStates = Array.prototype.slice.apply($("state[id=" + data_path + "*]"));
            for (var state in existingStates) {
                states.push(existingStates[state]);
            }

            //aus der Cloud abgerufene Daten in die States schreiben
            readData(JSON.parse(result));

            //Login, falls nötig
            if (JSON.parse(result).statusCode == 401) {
                console.log('Statuscode 401 --> Login nötig');
                login();
            }

            //Alle Datenpunkte leeren, für die keine neuen Werte empfangen wurden
            //außer den Token und userId
            //(Aktualisierte Datenpunkte werden bei mit der Funktion getData aus dem Array entfernt.)
            for (var state in states) {
                //console.log('State leeren > ' + states[state]);
                if (!(states[state].includes('token') || states[state].includes('userId'))) {
                    setState(states[state], '', true);
                    //console.log('State geleert');
                }
            }
        });
    }
}


//zyklischer Aufruf
var Intervall;
Intervall = setInterval(async function () {
  readFromCloud();
}, 5000);

//readFromCloud();
