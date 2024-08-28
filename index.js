const N3 = require('n3');
var fs = require('fs');
const QueryEngine = require('@comunica/query-sparql').QueryEngine;
var GeoJSON = require('geojson');


const myEngine = new QueryEngine();

let count = 0;
let quadArray = [];
let dataArray = [];
let jsonData = [];
let array_of_objects_test = [];
const store = new N3.Store();
const parser = new N3.Parser();
let data = '';
const pattern = /(.*)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/;

let pointName_set = new Set();
let lat_set = new Set();
let long_set = new Set();

reader = fs.createReadStream('data.ttl', {
    encoding: 'UTF-8',
});

reader.on('data', function (chunk) {
    //console.log(chunk);
    data += chunk;
});

reader.on('end', function () {
    console.log(`data streaming done.`);
    parser.parse(data.toString(), async (error, quad, prefixes) => {
        if (error) {
            console.error(error);
        } else if (quad) {
            //console.log(`${quad.subject.value}, ${quad.predicate.value}, ${quad.object.value}`);
            count += 1;
            quadArray.push(quad);
            store.addQuad(quad);
        }
        else {
            console.log(`parsing is complete. total number of quads is ${count}`);
            console.log('execution after parsing is done');
            let query_string =
                `   
                                
                        PREFIX ns: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

                        SELECT ?subject ?coordinate1 ?coordinate2
                        WHERE {
                        # Match any subject with the location predicate
                        ?subject <https://uri.etsi.org/ngsi-ld/location> ?location .

                        # Traverse to the hasValue triple
                        ?location <https://uri.etsi.org/ngsi-ld/hasValue> ?valueNode .
                        
                        # Traverse to the coordinates triple
                        ?valueNode <https://purl.org/geojson/vocab#coordinates> ?coordinatesNode .

                        # Get the first coordinate
                        ?coordinatesNode ns:first ?coordinate1 .

                        # Get the next node in the list and the second coordinate
                        ?coordinatesNode ns:rest ?nextNode .
                        ?nextNode ns:first ?coordinate2 .
                        }

                                    `
            const bindingsStream = await myEngine.queryBindings(query_string, {
                sources: [store]
            });

            bindingsStream.on('data', (binding) => {
                //console.log(`subject: ${binding.get('subject').value}`);
                //console.log(`coordinate1: ${binding.get('coordinate1').value}`);
                //console.log(`coordinate2: ${binding.get('coordinate2').value}`);
                match = binding.get('subject').value.match(pattern);
                record_name = match[1];
                dateTime = match[2];

                temp_obj = { 'name': `${record_name}`, 'time':`${dateTime}` ,'lat': `${binding.get('coordinate2').value}`, 'lng': ` ${binding.get('coordinate1').value}` };
                dataArray.push(temp_obj);
                /*
                if(pointName_set.has(binding.get('subject').value)==false&&lat_set.has(binding.get('coordinate2').value)==false&&long_set.has(binding.get('coordinate1').value)==false){
                    pointName_set.add(binding.get('subject').value);
                    lat_set.add(binding.get('coordinate2').value);
                    long_set.add(binding.get('coordinate1').value);
                    temp_obj = { 'name': `${binding.get('subject').value}`, 'lat': `${binding.get('coordinate2').value}`, 'lng': ` ${binding.get('coordinate1').value}` };
                    dataArray.push(temp_obj);

                }
                */
              

            });

            bindingsStream.on('end',(binding)=>{
                console.log('data binding ended');
                console.log('json data parsing started');
                jsonData = JSON.stringify(dataArray); // we need to implement a loop that goes over every json object, turns it into actual object and then adds it to an array of object that then gets passed to geojson
                ///////////////////////////////////////////////////////////
                
                /*
                jsonObject = jsonObject.map(item => ({
    ...item,
    lat: parseFloat(item.lat.trim()),
    lng: parseFloat(item.lng.trim())
}));
                */
                console.log('json data parsing ended');

              


                console.log('Json file writing started');
                fs.writeFile('Jsoncoordinates.json',jsonData.toString(),(err) => {
                    // In case of a error throw err.
                    if (err) throw err;
                });

                console.log('Json file writing ended');

               // Convert the data array to GeoJSON format
               const geojsonOutput = GeoJSON.parse(dataArray, { Point: ['lat', 'lng'] });

               // Pretty-print the GeoJSON output
               //console.log(JSON.stringify(geojsonOutput, null, 2));

               console.log('Geojson file writing started');
               fs.writeFile('Geojsoncoordinates.geojson',JSON.stringify(geojsonOutput, null, 2).toString(),(err) => {
                // In case of a error throw err.
                if (err) throw err;
            });
            console.log('Geojson file writing ended');


            })

        }
    });
});

