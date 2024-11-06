<?php

namespace Drupal\mosaic\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\search_api\Entity\Index;

/**
 * Displays an Openlayers Map for the Mosaic tool.
 *
 * {@inheritdoc}
 */
class MosaicController extends ControllerBase {

  /**
   * Create a render array with the OL map.
   *
   * {@inheritdoc}
   */
  public function render() {
    $config = $this->config('system.site');
    $site_name = $config->get('name');
    $prinfoQ1 = [];
    $prinfoQ2 = [];
    $prinfoQ3 = [];
    // Define queries and extract prinfo.
    $envQ1 = [-2.22, 52.29, 82.21, 72.70];
    $envQ2 = [5.00, 39.25, 70.84, 65.55];
    $envQ3 = [-1.70, 20.42, 66.74, 56.42];
    $envelops = [$envQ1, $envQ2, $envQ3];

    /** @var \Drupal\search_api\Entity\Index $index  TODO: Change to metsis when prepeare for release */
    $index = Index::load('metsis');

    // Define some query constants for mosaic tool.
    // Today.
    $day = (new \DateTime())->modify('-7 day')->format('Y-m-d\TH:i:s\Z');

    $queryQ1_prd = 'temporal_extent_start_date:[' . $day . ' TO *] AND bbox:"Intersects(ENVELOPE(-2.22, 52.29, 82.21, 72.70))"';
    $queryQ2_prd = 'temporal_extent_start_date:[' . $day . ' TO *] AND bbox:"Intersects(ENVELOPE(5.00, 39.25, 70.84, 65.55))"';
    $queryQ3_prd = 'temporal_extent_start_date:[' . $day . ' TO *] AND bbox:"Intersects(ENVELOPE(-1.70, 20.42, 66.74, 56.42))"';

    // Define the fields to be added to the resultSet.
    $fields[] = 'id';
    $fields[] = 'title';
    $fields[] = 'temporal_extent_start_date';
    $fields[] = 'temporal_extent_end_date';
    $fields[] = 'data_access_url_opendap';
    $fields[] = 'data_access_url_http';
    $fields[] = 'data_access_url_odata';
    $fields[] = 'data_access_url_ogc_wms';
    $fields[] = 'data_access_url_odata';
    $fields[] = 'data_access_wms_layers';
    $fields[] = 'geographic_extent_rectangle_south';
    $fields[] = 'geographic_extent_rectangle_north';
    $fields[] = 'geographic_extent_rectangle_west';
    $fields[] = 'geographic_extent_rectangle_east';

    /** @var \Drupal\search_api_solr\Plugin\search_api\backend\SearchApiSolrBackend $backend */
    $backend = $index->getServerInstance()->getBackend();

    $connector = $backend->getSolrConnector();

    $queryQ1 = $connector->getSelectQuery();
    $queryQ1->setQuery($queryQ1_prd);
    $queryQ1->setStart(0)->setRows(1500);
    $queryQ1->setFields($fields);
    $queryQ1->createFilterQuery('collection')->setQuery('collection:(NBS)');

    $queryQ2 = $connector->getSelectQuery();
    $queryQ2->setQuery($queryQ2_prd);
    $queryQ2->setStart(0)->setRows(1500);
    $queryQ2->setFields($fields);
    $queryQ2->createFilterQuery('collection')->setQuery('collection:(NBS)');

    $queryQ3 = $connector->getSelectQuery();
    $queryQ3->setQuery($queryQ3_prd);
    $queryQ3->setStart(0)->setRows(1500);
    $queryQ3->setFields($fields);
    $queryQ3->createFilterQuery('collection')->setQuery('collection:(NBS)');

    $resultQ1 = $connector->execute($queryQ1);
    $resultQ2 = $connector->execute($queryQ2);
    $resultQ3 = $connector->execute($queryQ3);
    /*
    $resultQ1 = $connector->select($queryQ1);
    $resultQ2 = $connector->select($queryQ2);
    $resultQ3 = $connector->select($queryQ3);
     */
    // $this->getLogger('mosaic_tool')->debug("Q1: " . $resultQ1->getNumFound());
    // $this->getLogger('mosaic_tool')->debug("Q2: " . $resultQ2->getNumFound());
    // $this->getLogger('mosaic_tool')->debug("Q3: " . $resultQ3->getNumFound());
    $count = 0;
    $count2 = 0;
    $count3 = 0;
    foreach ($resultQ1 as $doc) {
      $fields = $doc->getFields();
      $id = $fields['title'][0];
      // $address = $fields['data_access_url_ogc_wms'][0];
      $address = isset($fields['data_access_url_ogc_wms']) ? $fields['data_access_url_ogc_wms'][0] : 'NA';
      $start = $fields['temporal_extent_start_date'];
      $end = $fields['temporal_extent_end_date'];
      $north = $fields['geographic_extent_rectangle_north'];
      $south = $fields['geographic_extent_rectangle_south'];
      $east = $fields['geographic_extent_rectangle_east'];
      $west = $fields['geographic_extent_rectangle_west'];
      $uid = $fields['id'];
      $layers = isset($fields['data_access_wms_layers']) ? $fields['data_access_wms_layers'][0] : 'None';
      // $latlon = [($south + $north) / 2, ($east + $west) / 2];
      $prinfoQ1[$count] = [$address, $id, $layers, [$north, $south, $east, $west], [$start, $end], $uid];
      $count = $count + 1;
    }
    foreach ($resultQ2 as $doc) {
      $fields = $doc->getFields();
      $id = $fields['title'][0];
      // $address = $fields['data_access_url_ogc_wms'][0];
      $address = isset($fields['data_access_url_ogc_wms']) ? $fields['data_access_url_ogc_wms'][0] : 'NA';
      $start = $fields['temporal_extent_start_date'];
      $end = $fields['temporal_extent_end_date'];
      $north = $fields['geographic_extent_rectangle_north'];
      $south = $fields['geographic_extent_rectangle_south'];
      $east = $fields['geographic_extent_rectangle_east'];
      $west = $fields['geographic_extent_rectangle_west'];
      $uid = $fields['id'];
      $layers = isset($fields['data_access_wms_layers']) ? $fields['data_access_wms_layers'][0] : 'None';
      // $latlon = [($south + $north) / 2, ($east + $west) / 2];
      $prinfoQ2[$count2] = [$address, $id, $layers, [$north, $south, $east, $west], [$start, $end], $uid];
      $count2 = $count2 + 1;
    }
    foreach ($resultQ3 as $doc) {
      $fields = $doc->getFields();
      $id = $fields['title'][0];
      // $address = $fields['data_access_url_ogc_wms'][0];
      $address = isset($fields['data_access_url_ogc_wms']) ? $fields['data_access_url_ogc_wms'][0] : 'NA';
      $start = $fields['temporal_extent_start_date'];
      $end = $fields['temporal_extent_end_date'];
      $north = $fields['geographic_extent_rectangle_north'];
      $south = $fields['geographic_extent_rectangle_south'];
      $east = $fields['geographic_extent_rectangle_east'];
      $west = $fields['geographic_extent_rectangle_west'];
      $uid = $fields['id'];
      $layers = isset($fields['data_access_wms_layers']) ? $fields['data_access_wms_layers'][0] : 'None';
      // $latlon = [($south + $north) / 2, ($east + $west) / 2];
      $prinfoQ3[$count3] = [$address, $id, $layers, [$north, $south, $east, $west], [$start, $end], $uid];
      $count3 = $count3 + 1;
    }

    // JSON::encode($prinfoQ1);.
    /*    drupal_add_js(array('prinfoQ1' => $prinfoQ1,
    'prinfoQ2' => $prinfoQ2,
    'prinfoQ3' => $prinfoQ3,
    'envelops' => $envelops
    ), 'setting');

     */

    return [
      '#type' => 'container',
      '#theme' => 'mosaic-template',
      '#site_name' => $site_name,
      '#attached' => [
        'library' => [
          'mosaic/mosaic',
        ],

        'drupalSettings' => [
          'mosaic' => [
            'prinfoQ1' => $prinfoQ1,
            'prinfoQ2' => $prinfoQ2,
            'prinfoQ3' => $prinfoQ3,
            'envelops' => $envelops,
          ],
        ],
      ],
      '#cache' => [
        'max-age' => 0,
      ],
    ];
  }

}
