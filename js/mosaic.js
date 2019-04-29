// WGS 84 / UPS North (N,E)
proj4.defs('EPSG:32661', '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs');
var proj32661 = ol.proj.get('EPSG:32661');
var ex32661 = [-4e+06,-6e+06,8e+06,8e+06];
proj32661.setExtent(ex32661);
ol.proj.addProjection(proj32661);

var ext = ex32661;
var prj = proj32661;

// Import variables from php: array(address, id, layers)
var prinfoQ1 = Drupal.settings.prinfoQ1;
var prinfoQ2 = Drupal.settings.prinfoQ2;
var prinfoQ3 = Drupal.settings.prinfoQ3;

// Define all layers
var layer = {};

// Base layer WMS
layer['base']  = new ol.layer.Tile({
   type: 'base',
   title: 'base',
   displayInLayerSwitcher: false,
   source: new ol.source.TileWMS({ 
       url: 'http://public-wms.met.no/backgroundmaps/northpole.map',
       params: {'LAYERS': 'world', 'TRANSPARENT':'false', 'VERSION':'1.1.1','FORMAT':'image/png', 'SRS':prj},
       crossOrigin: 'anonymous'
   })
});

// Border layer WMS
layer['border']  = new ol.layer.Tile({
   title: 'border',
   source: new ol.source.TileWMS({ 
       url: 'http://public-wms.met.no/backgroundmaps/northpole.map',
       params: {'LAYERS': 'borders', 'TRANSPARENT':'true', 'VERSION':'1.1.1','FORMAT':'image/png', 'SRS':prj}
   })
});

// build up the map 
var centerLonLat1 = [15, 80];
var centerTrans1 = ol.proj.transform(centerLonLat1, "EPSG:4326",  prj);
var centerLonLat2 = [22, 68];
var centerTrans2 = ol.proj.transform(centerLonLat2, "EPSG:4326",  prj);
var centerLonLat3 = [15, 60];
var centerTrans3 = ol.proj.transform(centerLonLat3, "EPSG:4326",  prj);


var map = new ol.Map({
   controls: ol.control.defaults().extend([
      new ol.control.FullScreen()
   ]),
   target: 'map',
   layers: [ layer['base']
           ],
   view: new ol.View({
                 zoom: 4, 
                 minZoom: 4,
                 maxZoom: 13,
                 center: centerTrans1,
                 projection: prj,
                 extent: ext
   })
});

// create a progress bar to show the loading of tiles
function progress_bar() {
var tilesLoaded = 0;
var tilesPending = 0;
//load all S1 and S2 entries
map.getLayers().forEach(function(layer){ 
   if(layer.get('title') !== 'base'){
      layer.getLayers().forEach(function(layer){ 
         //for all tiles that are done loading update the progress bar
         layer.getSource().on('tileloadend', function() {
            tilesLoaded += 1;
            var percentage = Math.round(tilesLoaded / tilesPending * 100);
            document.getElementById('progress').style.width = percentage + '%';
            // fill the bar to the end
            if (percentage >= 100) {
               document.getElementById('progress').style.width = '100%';
               tilesLoaded = 0;
               tilesPending = 0;
            }
         });

         //for all tiles that are staring to load update the number of pending tiles
         layer.getSource().on('tileloadstart', function() {
         ++tilesPending;
         });
      });
      }
});
}

// metsis visualization on click? or metadata? 
function metadata_click() {
map.on('click', function(evt) {
  var first = true;
  map.forEachLayerAtPixel(evt.pixel, function(layer) {
     if (layer.get('title') != 'base' && first){
        //window.open('https://satellittdata.no/metsis/display/metadata/?core=l1&datasetID='+layer.get("title"));
        window.open('https://satellittdata.no/metsis/map/wms?dataset='+layer.get("title")+'&solr_core=nbs-l1');
        first = false;
     }
  });
});
}

// clickable ID in tooltop
function id_tooltip(){
var tooltip = document.getElementById('tooltip');
//var overlay = new ol.Overlay({
//  element: tooltip,
//});

//map.addOverlay(overlay);
function displayTooltip(evt) {
  var first = true;
  map.forEachLayerAtPixel(evt.pixel, function(layer) {
     if (layer.get('title') != 'base' && first){
        tooltip.style.display = '';
        //overlay.setPosition(evt.coordinate);
        tooltip.innerHTML = 'Get Metadata: <a target="_blank" href=\"https://satellittdata.no/metsis/display/metadata/?core=l1&datasetID='+layer.get('title')+'\">'+layer.get('title')+'</a>';
        first = false;
     }
  });
};

map.on('pointermove', displayTooltip);

}
//define times for time control
var today = new Date();
var tda = new Date();
tda.setDate(tda.getDate()-3);

// Create Timeline control 
tline = new ol.control.Timeline({
  features: layer,
  interval: '1h',  // 90 days = 3 month interval
  graduation: 'day', // 'month'
  minDate: tda,
  maxDate: today,
  getHTML: function(f){ return f.text; },
  getFeatureDate: function(f){ return f.date; },
  endFeatureDate: function(f) { return f.endDate }
});
map.addControl(tline);
tline.setDate(today);

// Show features on scroll
tline.on('scroll', function(e){
  // Start and end date
  // e.g. 2019-04-25T10:55:12.194Z
  //$('.dateStart').text(e.dateStart.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}));
  $('.dateStart').text(e.dateStart);
  //$('.dateEnd').text(e.dateEnd.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}));
  $('.dateEnd').text(e.dateEnd);
  // Filter features visibility
  map.getLayers().forEach(function(f) {
     if(f.get('title') !== 'base'){
     f.getLayers().forEach(function(g) {
        var dateS = g.get('acqStart');
        var dateE = g.get('acqEnd');
        //console.log('date', e.dateStart, e.dateEnd);
        //console.log('sten', dateS, dateE);
        if (dateE<e.dateStart || dateS>e.dateEnd) {
          g.setVisible(false);
        } else {
          g.setVisible(true);
        }
     })}
  });
});

// define map for the first tab including all S1 and S2 products of today.  
function Q1(){

// Assign the active class to the tab 
document.getElementById('Q2-tab').classList.remove('active');
document.getElementById('Q3-tab').classList.remove('active');
document.getElementById('Q1-tab').classList.add('active');

map.getView().setCenter(centerTrans1);
// Remove all layers that are not base
var layersToRemove = [];
map.getLayers().forEach(function (layer) {
   if (layer.get('title') != 'base'){
      layersToRemove.push(layer);
   }
});
for(var i=0; i< layersToRemove.length; i++) {
   map.removeLayer(layersToRemove[i]);
}

var list_of_layers_S1_Q1 = []; 
var list_of_layers_S2_Q1 = []; 

// add the layers to the groups
for(var i12=0; i12 <= prinfoQ1.length-1; i12++){
   var no =  prinfoQ1[i12][3][0];
   var so =  prinfoQ1[i12][3][1];
   var ea =  prinfoQ1[i12][3][2];
   var we =  prinfoQ1[i12][3][3];
   // LonLat corners w-s, e-s, e-n, w-n
   var miny = ol.proj.transform([we,so], "EPSG:4326",  prj)[1];
   var maxx = ol.proj.transform([ea,so], "EPSG:4326",  prj)[0];
   var maxy = ol.proj.transform([ea,no], "EPSG:4326",  prj)[1];
   var minx = ol.proj.transform([we,no], "EPSG:4326",  prj)[0];
   //console.log(no,so,ea,we);
   //console.log(minx,miny,maxx,maxy);

   //console.log(prinfoQ1[i12][4][0]);
   //console.log(prinfoQ1[i12][4][1]);
   if (prinfoQ1[i12][1].includes("S2")){ 
      layer[i12] = new ol.layer.Tile({
         visible: false,
         title: prinfoQ1[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ1[i12][4][0]), 
         acqEnd: new Date(prinfoQ1[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ1[i12][0],
         params: {'LAYERS': 'true_color_vegetation', 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256', 'BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
      list_of_layers_S2_Q1.push(layer[i12]);
   }else{
      if(prinfoQ1[i12][2][0] == "Amplitude VV polarisation"){
         var lyr = 'amplitude_vv';
      }else{
         var lyr = 'amplitude_hh';
      }
      layer[i12] = new ol.layer.Tile({
         visible: false,
         title: prinfoQ1[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ1[i12][4][0]), 
         acqEnd: new Date(prinfoQ1[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ1[i12][0],
         params: {'LAYERS': lyr, 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256','BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
      list_of_layers_S1_Q1.push(layer[i12]);
   }
}

// build up the S1 and S2 groups
var S1_groupQ1 = new ol.layer.Group({
   title: 'S1',
   openInLayerSwitcher: false,
   layers: list_of_layers_S1_Q1
});

var S2_groupQ1 = new ol.layer.Group({
   title: 'S2',
   openInLayerSwitcher: false,
   layers: list_of_layers_S2_Q1
});

// wait for base layer to be loaded
//layer["base"].getSource().on('tileloadend', function(event){
   map.addLayer(S1_groupQ1);
   map.addLayer(S2_groupQ1);

progress_bar()
//});

// get metadata on click
metadata_click()

// display clickable ID in tooltip
id_tooltip()



}
// call the map as default when loading the page. 
Q1();

function Q2(){

map.getView().setCenter(centerTrans2);

// Assign the active class to the tab 
document.getElementById('Q1-tab').classList.remove('active');
document.getElementById('Q3-tab').classList.remove('active');
document.getElementById('Q2-tab').classList.add('active');

// Remove all layers that are not base
var layersToRemove = [];
map.getLayers().forEach(function (layer) {
   if (layer.get('title') != 'base'){
      layersToRemove.push(layer);
   }
});
for(var i=0; i< layersToRemove.length; i++) {
   map.removeLayer(layersToRemove[i]);
}

var list_of_layers_S1_Q2 = []; 
var list_of_layers_S2_Q2 = []; 

// add the layers to the groups
for(var i12=0; i12 <= prinfoQ2.length-1; i12++){
   var no =  prinfoQ2[i12][3][0];
   var so =  prinfoQ2[i12][3][1];
   var ea =  prinfoQ2[i12][3][2];
   var we =  prinfoQ2[i12][3][3];
   // LonLat corners w-s, e-s, e-n, w-n
   var miny = ol.proj.transform([we,so], "EPSG:4326",  prj)[1];
   var maxx = ol.proj.transform([ea,so], "EPSG:4326",  prj)[0];
   var maxy = ol.proj.transform([ea,no], "EPSG:4326",  prj)[1];
   var minx = ol.proj.transform([we,no], "EPSG:4326",  prj)[0];
   if (prinfoQ2[i12][1].includes("S2")){ 
      layer[i12] = new ol.layer.Tile({
         title: prinfoQ2[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ2[i12][4][0]), 
         acqEnd: new Date(prinfoQ2[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ2[i12][0],
         params: {'LAYERS': 'true_color_vegetation', 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256', 'BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
   list_of_layers_S2_Q2.push(layer[i12]);
   }else{
      if(prinfoQ2[i12][2][0] == "Amplitude VV polarisation"){
         var lyr = 'amplitude_vv';
      }else{
         var lyr = 'amplitude_hh';
      }
      layer[i12] = new ol.layer.Tile({
         title: prinfoQ2[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ2[i12][4][0]), 
         acqEnd: new Date(prinfoQ2[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ2[i12][0],
         params: {'LAYERS': lyr, 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256', 'BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
   list_of_layers_S1_Q2.push(layer[i12]);
   }
}

// build up the S1 and S2 groups
var S1_groupQ2 = new ol.layer.Group({
   title: 'S1',
   openInLayerSwitcher: false,
   layers: list_of_layers_S1_Q2
});

var S2_groupQ2 = new ol.layer.Group({
   title: 'S2',
   openInLayerSwitcher: false,
   layers: list_of_layers_S2_Q2
});

map.addLayer(S1_groupQ2);
map.addLayer(S2_groupQ2);

progress_bar()

// get metadata on click
metadata_click()

// display clickable ID in tooltip
id_tooltip()

map.getLayers().getArray()[2].on('tileloadend', function(event) {
   document.getElementById("progress").style.width = '20%';
});

}
// define map for the first tab including all S1 and S2 products of today.  
function Q3(){

// Assign the active class to the tab 
document.getElementById('Q1-tab').classList.remove('active');
document.getElementById('Q2-tab').classList.remove('active');
document.getElementById('Q3-tab').classList.add('active');

map.getView().setCenter(centerTrans3);
// Remove all layers that are not base
var layersToRemove = [];
map.getLayers().forEach(function (layer) {
   if (layer.get('title') != 'base'){
      layersToRemove.push(layer);
   }
});
for(var i=0; i< layersToRemove.length; i++) {
   map.removeLayer(layersToRemove[i]);
}

var list_of_layers_S1_Q3 = []; 
var list_of_layers_S2_Q3 = []; 

// add the layers to the groups
for(var i12=0; i12 <= prinfoQ3.length-1; i12++){
   var no =  prinfoQ3[i12][3][0];
   var so =  prinfoQ3[i12][3][1];
   var ea =  prinfoQ3[i12][3][2];
   var we =  prinfoQ3[i12][3][3];
   // LonLat corners w-s, e-s, e-n, w-n
   var miny = ol.proj.transform([we,so], "EPSG:4326",  prj)[1];
   var maxx = ol.proj.transform([ea,so], "EPSG:4326",  prj)[0];
   var maxy = ol.proj.transform([ea,no], "EPSG:4326",  prj)[1];
   var minx = ol.proj.transform([we,no], "EPSG:4326",  prj)[0];
   if (prinfoQ3[i12][1].includes("S2")){ 
      layer[i12] = new ol.layer.Tile({
         title: prinfoQ3[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ3[i12][4][0]), 
         acqEnd: new Date(prinfoQ3[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ3[i12][0],
         params: {'LAYERS': 'true_color_vegetation', 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256', 'BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
   list_of_layers_S2_Q3.push(layer[i12]);
   }else{
      if(prinfoQ3[i12][2][0] == "Amplitude VV polarisation"){
         var lyr = 'amplitude_vv';
      }else{
         var lyr = 'amplitude_hh';
      }
      layer[i12] = new ol.layer.Tile({
         title: prinfoQ3[i12][1],
         displayInLayerSwitcher: false,
         acqStart: new Date(prinfoQ3[i12][4][0]), 
         acqEnd: new Date(prinfoQ3[i12][4][1]),
         source: new ol.source.TileWMS({ 
         url: prinfoQ3[i12][0],
         params: {'LAYERS': lyr, 'TRANSPARENT':'true', 'FORMAT':'image/png', 'CRS':'EPSG:32661', 'VERSION':'1.3.0', 'SERVICE':'WMS','REQUEST':'GetMap','TILE':'true','WIDTH':'256','HEIGHT':'256', 'BBOX':'minx,miny,maxx,maxy'},
         crossOrigin: 'anonymous'
         })
      });
   list_of_layers_S1_Q3.push(layer[i12]);
   }
}

// build up the S1 and S2 groups
var S1_groupQ3 = new ol.layer.Group({
   title: 'S1',
   openInLayerSwitcher: false,
   layers: list_of_layers_S1_Q3
});

var S2_groupQ3 = new ol.layer.Group({
   title: 'S2',
   openInLayerSwitcher: false,
   layers: list_of_layers_S2_Q3
});

map.addLayer(S1_groupQ3);
map.addLayer(S2_groupQ3);

// get progress bar
progress_bar()

// get metadata on click
metadata_click()

// display clickable ID in tooltip
id_tooltip()

map.getLayers().getArray()[2].on('tileloadend', function(event) {
   document.getElementById("progress").style.width = '20%';
});

}

//Layer switcher
//var lswitcher = new ol.control.LayerSwitcher({targer:$(".layerSwithcer").get(0),});
var lswitcher = new ol.control.LayerSwitcher({});
map.addControl(lswitcher);
lswitcher.showPanel();

//Mouseposition
var mousePositionControl = new ol.control.MousePosition({
   coordinateFormat : function(co) {
      return ol.coordinate.format(co, template = 'lon: {x}, lat: {y}', 2);
   },
   projection : 'EPSG:4326', 
});
map.addControl(mousePositionControl);



