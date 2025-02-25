console.log("Start of mosaic map script:");
(function($, Drupal, drupalSettings, once) {

  console.log("Attaching mosaic script to drupal behaviours:");
  /** Attach the metsis map to drupal behaviours function */
  Drupal.behaviors.mosaic = {
    attach: function(context) {
      const mapEl = $(once('#map', '[data-mosaic-map]', context));
      mapEl.each(function () {
      //$('#map', context).each(function() {
        //$('#map-res', context).once('metsisSearchBlock').each(function() {
        /** Start reading drupalSettings sent from the mapblock build */
        console.log('Initializing MOSAIC Map...');


        // WGS 84 / UPS North (N,E)
  /*      proj4.defs('EPSG:32661', '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs');
        ol.proj.proj4.register(proj4);
        let proj32661 = ol.proj.get('EPSG:32661');
        let ex32661 = [-4e+06, -6e+06, 8e+06, 8e+06];

        proj32661.setExtent(ex32661);
        ol.proj.addProjection(proj32661);

        let ext = ex32661;
        let prj = proj32661;
        let defzoom = 4;
*/
        // WGS 84 / UPS North (N,E)
        proj4.defs('EPSG:32661', '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs');
        ol.proj.proj4.register(proj4);
        let proj32661 = ol.proj.get('EPSG:32661');
        let ex32661 = [-4e+06,-6e+06,8e+06,8e+06];
        proj32661.setExtent(ex32661);
        ol.proj.addProjection(proj32661);

        let ext = ex32661;
        let prj = proj32661;
        let defzoom = 4;
        // Import letiables from php: array(address, id, layers)
        let prinfoQ1 = drupalSettings.mosaic.prinfoQ1;
        let prinfoQ2 = drupalSettings.mosaic.prinfoQ2;
        let prinfoQ3 = drupalSettings.mosaic.prinfoQ3;
        let envelops = drupalSettings.mosaic.envelops;

        console.log("Q1 results: " +prinfoQ1.length);
        console.log("Q2 results: " +prinfoQ2.length);
        console.log("Q3 results: " +prinfoQ3.length);

        // Define all layers
        var layer = {};
        var lyr = '';

        // Base layer WMS
        layer['base']  = new ol.layer.Tile({
          type: 'base',
          title: 'base',
          displayInLayerSwitcher: false,
          source: new ol.source.OSM({}),
        });
        /**
         * Define different basemaps layers to choose from here.
         * Using layergroups and radio selection
         */

        // Border layer WMS
        //layer['border']  = new ol.layer.Tile({
        //   title: 'border',
        //   source: new ol.source.TileWMS({
        //       url: 'http://public-wms.met.no/backgroundmaps/northpole.map',
        //       params: {'LAYERS': 'borders', 'TRANSPARENT':'true', 'VERSION':'1.1.1','FORMAT':'image/png', 'SRS':prj}
        //   })
        //});

        // build up the map
        let centerLonLat1 = [18, 80];
        let centerTrans1 = ol.proj.transform(centerLonLat1, "EPSG:4326", prj);
        let centerLonLat2 = [22, 68];
        let centerTrans2 = ol.proj.transform(centerLonLat2, "EPSG:4326", prj);
        let centerLonLat3 = [15, 60];
        let centerTrans3 = ol.proj.transform(centerLonLat3, "EPSG:4326", prj);

        // define exents: (minx, miny, maxx, maxy)
        let Q1_ext = [envelops[0][0], envelops[0][3], envelops[0][1], envelops[0][2]];
        let Q2_ext = [envelops[1][0], envelops[1][3], envelops[1][1], envelops[1][2]];
        let Q3_ext = [envelops[2][0], envelops[2][3], envelops[2][1], envelops[2][2]];

        console.log("Creating the map");
        let map = new ol.Map({
          controls: ol.control.defaults().extend([
            new ol.control.FullScreen()
          ]),
          target: 'map',
          layers: [layer['base']],
          view: new ol.View({
            zoom: defzoom,
            minZoom: 3,
            maxZoom: 10,
            center: centerTrans1,
            //projection: prj,
            projection: "EPSG:32661",
            //extent: prj.extent,
            //extent: ol.proj.transformExtent(Q1_ext, "EPSG:4326", prj)
          })
        });

        // create a progress bar to show the loading of tiles
        function progress_bar() {
          let tilesLoaded = 0;
          let tilesPending = 0;
          let percentage = 0;
          //load all S1 and S2 entries
          map.getLayers().forEach(function(layer) {
            if (layer.get('title') !== 'base') {
              layer.getLayers().forEach(function(layer) {
                //for all tiles that are done loading update the progress bar
                layer.getSource().on('tileloadend', function() {
                  tilesLoaded += 1;
                  percentage = Math.round(tilesLoaded / tilesPending * 100);
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
            let first = true;
            map.forEachLayerAtPixel(evt.pixel, function(layer) {
              if (layer.get('title') != 'base' && first) {
                //window.open('https://satellittdata.no/metsis/display/metadata/?core=l1&datasetID='+layer.get("title"));
                window.open('/metsis/map/wms?dataset=' + layer.get("uid"));
                first = false;
              }
            });
          });
        }

        // clickable ID in tooltop
        function id_tooltip() {
          let tooltip = document.getElementById('tooltip');

          map.on('pointermove', function(evt) {
            let first = true;
            map.forEachLayerAtPixel(evt.pixel, function(layer) {
              if (layer.get('title') != 'base' && first) {
                tooltip.style.display = 'inline-block';
                tooltip.innerHTML = 'Get Metadata: <a class="use-ajax" data-dialog-options="{"width":600, "title":"Metadata Details"}" data-dialog-type="dialog" data-dialog-renderer="off-canvas" href="/metsis/metadata/' + layer.get('uid') + '">' + layer.get('title') + '</a>';
                first = false;
              }
            });
          });
        }

        function id_tooltip_clear() {
          document.getElementById('tooltip').style.display = 'none';
        }
        // define map for the first tab including all S1 and S2 products of today.
        function Q1() {
          console.log("inside Q1: " + prinfoQ1.length);
          // Assign the active class to the tab
          document.getElementById('Q2-tab').classList.remove('active');
          document.getElementById('Q3-tab').classList.remove('active');
          document.getElementById('Q1-tab').classList.add('active');

          id_tooltip_clear()

          //map.setView(new ol.View({
            //center: centerTrans1,
            //extent: ol.proj.transformExtent(Q1_ext, "EPSG:4326", prj),
            //minZoom: 0,
            //maxZoom: 23,
            //projection: prj,
            //zoom: defzoom
          //}));

          // Remove all layers that are not base
          let layersToRemove = [];
          map.getLayers().forEach(function(layer) {
            if (layer.get('title') != 'base') {
              layersToRemove.push(layer);
            }
          });
          for (let i = 0; i < layersToRemove.length; i++) {
            map.removeLayer(layersToRemove[i]);
          }

          let list_of_layers_S1_Q1 = [];
          let list_of_layers_S2_Q1 = [];

          // add the layers to the groups
          for (let i12 = 0; i12 <= prinfoQ1.length - 1; i12++) {
            let no = prinfoQ1[i12][3][0];
            let so = prinfoQ1[i12][3][1];
            let ea = prinfoQ1[i12][3][2];
            let we = prinfoQ1[i12][3][3];
            // LonLat corners w-s, e-s, e-n, w-n
            let miny = ol.proj.transform([we, so], "EPSG:4326", prj)[1];
            let maxx = ol.proj.transform([ea, so], "EPSG:4326", prj)[0];
            let maxy = ol.proj.transform([ea, no], "EPSG:4326", prj)[1];
            let minx = ol.proj.transform([we, no], "EPSG:4326", prj)[0];

            if (prinfoQ1[i12][1].includes("S2")) {
              let wmsUrl = prinfoQ1[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ1[i12][1],
                extent: ol.proj.transformExtent(Q1_ext, "EPSG:4326", prj),
                displayInLayerSwitcher: false,
                acqStart: new Date(prinfoQ1[i12][4][0]),
                acqEnd: new Date(prinfoQ1[i12][4][1]),
                uid: prinfoQ1[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': 'true_color_vegetation',
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                    //'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S2_Q1.push(layer[i12]);
            } else {
              if (prinfoQ1[i12][2] === "Amplitude VV polarisation") {
                lyr = 'amplitude_vv';
              } else {
                lyr = 'amplitude_hh';
              }
              let wmsUrl = prinfoQ1[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ1[i12][1],
                extent: ol.proj.transformExtent(Q1_ext, "EPSG:4326", prj),
                displayInLayerSwitcher: false,
                acqStart: new Date(prinfoQ1[i12][4][0]),
                acqEnd: new Date(prinfoQ1[i12][4][1]),
                uid: prinfoQ1[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': lyr,
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                    //'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S1_Q1.push(layer[i12]);
            }
          }

          // build up the S1 and S2 groups
          let S1_groupQ1 = new ol.layer.Group({
            title: 'S1',
            openInLayerSwitcher: false,
            layers: list_of_layers_S1_Q1
          });

          let S2_groupQ1 = new ol.layer.Group({
            title: 'S2',
            openInLayerSwitcher: false,
            layers: list_of_layers_S2_Q1
          });

          //should be adding the composites
          //....getLayers().forEach(function(layer) {layer.getSource().updateParams({'LAYERS': 'false_color_glacier'})})

          // wait for base layer to be loaded
          //layer["base"].getSource().on('tileloadend', function(event){
          map.addLayer(S1_groupQ1);
          map.addLayer(S2_groupQ1);

          map.getView().setCenter(centerTrans1)
          map.getView().set('extent', ol.proj.transformExtent(Q1_ext, "EPSG:4326", prj))
          map.getView().setZoom(defzoom)

          progress_bar()
          //});

          // get metadata on click
          metadata_click()

          // display clickable ID in tooltip
          id_tooltip()

          tline.dispatchEvent({
            type: 'scroll',
            date: tline.getDate(),
            dateStart: tline.getDate('start'),
            dateEnd: tline.getDate('end')
          });
          console.log("End of Q1");
        }

        function Q2() {
            console.log("inside Q2: " + prinfoQ2.length);
          // Assign the active class to the tab
          document.getElementById('Q1-tab').classList.remove('active');
          document.getElementById('Q3-tab').classList.remove('active');
          document.getElementById('Q2-tab').classList.add('active');

          id_tooltip_clear()
          //map.getView().setCenter(centerTrans2);
        //  map.setView(new ol.View({
          //  center: centerTrans2,
            //minZoom: 2,
            //maxZoom: 12,
            //projection: prj,
            //extent: ol.proj.transformExtent(Q2_ext, "EPSG:4326", prj),
            //zoom: defzoom
          //}));

          // Remove all layers that are not base
          let layersToRemove = [];
          map.getLayers().forEach(function(layer) {
            if (layer.get('title') != 'base') {
              layersToRemove.push(layer);
            }
          });
          for (let i = 0; i < layersToRemove.length; i++) {
            map.removeLayer(layersToRemove[i]);
          }

          let list_of_layers_S1_Q2 = [];
          let list_of_layers_S2_Q2 = [];

          // add the layers to the groups
          for (let i12 = 0; i12 <= prinfoQ2.length - 1; i12++) {
            let no = prinfoQ2[i12][3][0];
            let so = prinfoQ2[i12][3][1];
            let ea = prinfoQ2[i12][3][2];
            let we = prinfoQ2[i12][3][3];
            // LonLat corners w-s, e-s, e-n, w-n
            let miny = ol.proj.transform([we, so], "EPSG:4326", prj)[1];
            let maxx = ol.proj.transform([ea, so], "EPSG:4326", prj)[0];
            let maxy = ol.proj.transform([ea, no], "EPSG:4326", prj)[1];
            let minx = ol.proj.transform([we, no], "EPSG:4326", prj)[0];
            if (prinfoQ2[i12][1].includes("S2")) {
              let wmsUrl = prinfoQ2[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ2[i12][1],
                  extent: ol.proj.transformExtent(Q2_ext, "EPSG:4326", prj),
                displayInLayerSwitcher: false,
                acqStart: new Date(prinfoQ2[i12][4][0]),
                acqEnd: new Date(prinfoQ2[i12][4][1]),
                uid: prinfoQ2[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': 'true_color_vegetation',
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                    //'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S2_Q2.push(layer[i12]);
            } else {
              if (prinfoQ2[i12][2] === "Amplitude VV polarisation") {
                lyr = 'amplitude_vv';
                  //console.log("got layer: " + lyr + " for: " + prinfoQ2[i12][1]);
              } else {
                lyr = 'amplitude_hh';
                //console.log("got layer: " + lyr + " for: " + prinfoQ2[i12][1]);
              }
              let wmsUrl = prinfoQ2[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ2[i12][1],
                displayInLayerSwitcher: false,
                  extent: ol.proj.transformExtent(Q2_ext, "EPSG:4326", prj),
                acqStart: new Date(prinfoQ2[i12][4][0]),
                acqEnd: new Date(prinfoQ2[i12][4][1]),
                uid: prinfoQ2[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': lyr,
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                  //  'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S1_Q2.push(layer[i12]);
            }
          }

          // build up the S1 and S2 groups
          let S1_groupQ2 = new ol.layer.Group({
            title: 'S1',
            openInLayerSwitcher: false,
            layers: list_of_layers_S1_Q2
          });

          let S2_groupQ2 = new ol.layer.Group({
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
          map.getView().setCenter(centerTrans2)
          map.getView().set('extent', ol.proj.transformExtent(Q2_ext, "EPSG:4326", prj))
          map.getView().setZoom(defzoom)

          tline.dispatchEvent({
            type: 'scroll',
            date: tline.getDate(),
            dateStart: tline.getDate('start'),
            dateEnd: tline.getDate('end')
          });

        }
        // define map for the first tab including all S1 and S2 products of today.
        function Q3() {
            console.log("inside Q3: " + prinfoQ3.length);
          // Assign the active class to the tab
          document.getElementById('Q1-tab').classList.remove('active');
          document.getElementById('Q2-tab').classList.remove('active');
          document.getElementById('Q3-tab').classList.add('active');

          id_tooltip_clear()

            //map.getView().setCenter(centerTrans3);
            //map.getView().setZoom(defzoom);
          //map.setView(new ol.View({
            //center: centerTrans3,
            //minZoom: 2,
            //maxZoom: 12,
            //projection: prj,
            //extent: ol.proj.transformExtent(Q3_ext, "EPSG:4326", prj),
            //zoom: defzoom
          //}));

          // Remove all layers that are not base
          let layersToRemove = [];
          map.getLayers().forEach(function(layer) {
            if (layer.get('title') != 'base') {
              layersToRemove.push(layer);
            }
          });
          for (let i = 0; i < layersToRemove.length; i++) {
            map.removeLayer(layersToRemove[i]);
          }

          let list_of_layers_S1_Q3 = [];
          let list_of_layers_S2_Q3 = [];

          // add the layers to the groups
          for (let i12 = 0; i12 <= prinfoQ3.length - 1; i12++) {
            let no = prinfoQ3[i12][3][0];
            let so = prinfoQ3[i12][3][1];
            let ea = prinfoQ3[i12][3][2];
            let we = prinfoQ3[i12][3][3];
            // LonLat corners w-s, e-s, e-n, w-n
            let miny = ol.proj.transform([we, so], "EPSG:4326", prj)[1];
            let maxx = ol.proj.transform([ea, so], "EPSG:4326", prj)[0];
            let maxy = ol.proj.transform([ea, no], "EPSG:4326", prj)[1];
            let minx = ol.proj.transform([we, no], "EPSG:4326", prj)[0];
            if (prinfoQ3[i12][1].includes("S2")) {
              let wmsUrl = prinfoQ3[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ3[i12][1],
                  extent: ol.proj.transformExtent(Q3_ext, "EPSG:4326", prj),
                displayInLayerSwitcher: false,
                acqStart: new Date(prinfoQ3[i12][4][0]),
                acqEnd: new Date(prinfoQ3[i12][4][1]),
                uid: prinfoQ3[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': 'true_color_vegetation',
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                    //'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S2_Q3.push(layer[i12]);
            } else {
              if (prinfoQ3[i12][2] === "Amplitude VV polarisation") {
                lyr = 'amplitude_vv';
              } else {
                lyr = 'amplitude_hh';
              }
              let wmsUrl = prinfoQ3[i12][0];
              wmsUrl = wmsUrl.replace(/(^\w+:|^)\/\//, '//');
              wmsUrl = wmsUrl.split("?")[0];
              layer[i12] = new ol.layer.Tile({
                visible: false,
                title: prinfoQ3[i12][1],
                displayInLayerSwitcher: false,
                  extent: ol.proj.transformExtent(Q3_ext, "EPSG:4326", prj),
                acqStart: new Date(prinfoQ3[i12][4][0]),
                acqEnd: new Date(prinfoQ3[i12][4][1]),
                uid: prinfoQ3[i12][5],
                source: new ol.source.TileWMS({
                  url: wmsUrl,
                  //projection: prj,
                  params: {
                    'LAYERS': lyr,
                    'TRANSPARENT': 'true',
                    'FORMAT': 'image/png',
                    //'CRS': 'EPSG:32661',
                    'VERSION': '1.3.0',
                    //'SERVICE': 'WMS',
                    //'REQUEST': 'GetMap',
                    //'TILE': 'true',
                    //'WIDTH': '256',
                    //'HEIGHT': '256',
                    //'BBOX': 'minx,miny,maxx,maxy'
                  },
                  crossOrigin: 'anonymous'
                })
              });
              list_of_layers_S1_Q3.push(layer[i12]);
            }
          }

          // build up the S1 and S2 groups
          let S1_groupQ3 = new ol.layer.Group({
            title: 'S1',
            openInLayerSwitcher: false,
            layers: list_of_layers_S1_Q3
          });

          let S2_groupQ3 = new ol.layer.Group({
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
          map.getView().setCenter(centerTrans3)
          map.getView().set('extent', ol.proj.transformExtent(Q3_ext, "EPSG:4326", prj))
          map.getView().setZoom(defzoom)


          tline.dispatchEvent({
            type: 'scroll',
            date: tline.getDate(),
            dateStart: tline.getDate('start'),
            dateEnd: tline.getDate('end')
          });
        }

        //define times for time control
        let today = new Date();
        let tda = new Date();
        tda.setDate(tda.getDate() - 7);

        // Create Timeline control
         let tline = new ol.control.Timeline({
          features: layer,
          interval: '6h', // 90 days = 3 month interval
          graduation: 'day', // 'month'
          minDate: tda,
          maxDate: today,
          getHTML: function(f) {
            return f.text;
          },
          getFeatureDate: function(f) {
            return f.date;
          },
          endFeatureDate: function(f) {
            return f.endDate
          }
        });
        map.addControl(tline);
        tline.setDate(today);

        // Show features on scroll
        tline.on('scroll', function(e) {
          // Start and end date
          // e.g. 2019-04-25T10:55:12.194Z
          //$('.dateStart').text(e.dateStart.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}));
          $('.dateStart').text(e.dateStart);
          //$('.dateEnd').text(e.dateEnd.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}));
          $('.dateEnd').text(e.dateEnd);
          // Filter features visibility
          map.getLayers().forEach(function(f) {
            if (f.get('title') !== 'base') {
              f.getLayers().forEach(function(g) {
                let dateS = g.get('acqStart');
                let dateE = g.get('acqEnd');
                //console.log('date', e.dateStart, e.dateEnd);
                //console.log('sten', dateS, dateE);
                if (dateE < e.dateStart || dateS > e.dateEnd) {
                  g.setVisible(false);
                } else {
                  g.setVisible(true);
                  g.getSource().refresh();
                }
              })
            }
          });
        });

        // call the map as default when loading the page.
        console.log("Calling Q1");
        Q1();



        //Layer switcher
        //let lswitcher = new ol.control.LayerSwitcher({targer:$(".layerSwithcer").get(0),});
        let lswitcher = new ol.control.LayerSwitcher({});
        map.addControl(lswitcher);

        //Mouseposition
        let mousePositionControl = new ol.control.MousePosition({
          coordinateFormat: function(co) {
            return ol.coordinate.format(co, template = 'lon: {x}, lat: {y}', 2);
          },
          projection: 'EPSG:4326',
        });
        map.addControl(mousePositionControl);


                //Add eventlistener to tabs
                console.log("Register tab events")
                $('#Q1-tab').on('click' , function() {Q1() });
                $('#Q2-tab').on('click' , function() {Q2() });
                $('#Q3-tab').on('click' , function() {Q3() });

        console.log("End of mosaic script");
      });
    },
  };

})(jQuery, Drupal, drupalSettings, once);
