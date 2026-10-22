<?php

declare(strict_types=1);

namespace Drupal\Tests\mosaic\Unit;

use Drupal\Tests\UnitTestCase;
use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\EntityStorageInterface;
use Drupal\metsis_drupal\Service\SolrConnectorProvider;
use Drupal\metsis_drupal\Service\SolrQueryFactory;
use Drupal\mosaic\Service\MosaicSearch;
use Drupal\search_api\IndexInterface;
use Drupal\search_api\ServerInterface;
use Drupal\search_api_solr\Plugin\search_api\backend\SearchApiSolrBackend;
use Drupal\search_api_solr\SolrConnectorInterface;
use Drupal\search_api_solr\SearchApiSolrException;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\NullLogger;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Solarium\QueryType\Select\Query\Query;

/**
 * Tests validated filters and normalized map products.
 */
#[Group('mosaic')]
final class MosaicSearchTest extends UnitTestCase {

  /**
   * The query service under test.
   */
  private MosaicSearch $search;

  /**
   * The shared connector mock.
   */
  private SolrConnectorInterface & MockObject $connector;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $time = $this->createMock(TimeInterface::class);
    $time->method('getRequestTime')->willReturn(strtotime('2026-10-22T16:00:00Z'));
    $connector = $this->createMock(SolrConnectorInterface::class);
    $this->connector = $connector;
    $connector->method('getSelectQuery')->willReturnCallback(static fn() => new Query());
    $backend = $this->createMock(SearchApiSolrBackend::class);
    $backend->method('getSolrConnector')->willReturn($connector);
    $server = $this->createMock(ServerInterface::class);
    $server->method('getBackend')->willReturn($backend);
    $index = $this->createMock(IndexInterface::class);
    $index->method('getServerInstance')->willReturn($server);
    $storage = $this->createMock(EntityStorageInterface::class);
    $storage->method('load')->with('metsis')->willReturn($index);
    $entity_type_manager = $this->createMock(EntityTypeManagerInterface::class);
    $entity_type_manager->method('getStorage')->with('search_api_index')->willReturn($storage);
    $provider = new SolrConnectorProvider($entity_type_manager);
    $this->search = new MosaicSearch(new SolrQueryFactory($provider), $provider, $time, new NullLogger());
  }

  /**
   * Tests the initial rolling window is precisely 24 hours in UTC.
   */
  public function testDefaultState(): void {
    $state = $this->search->getState([]);
    self::assertSame('2026-10-21T16:00:00Z', $state['start']);
    self::assertSame('2026-10-22T16:00:00Z', $state['end']);
    self::assertSame(MosaicSearch::MISSIONS, $state['missions']);
    self::assertSame([], $this->search->getState(['submitted' => '1'])['missions']);
    $historical = $this->search->getState(['date' => '2026-10-20']);
    self::assertSame('2026-10-20T00:00:00Z', $historical['start']);
    self::assertSame('2026-10-20T23:59:59Z', $historical['end']);
  }

  /**
   * Tests malformed or unsupported filter values are rejected.
   */
  public function testInvalidFilters(): void {
    foreach ([
      ['region' => 'unknown'],
      ['date' => '2026-02-30'],
      ['date' => '2026-10-23'],
      ['missions' => ['Sentinel-3']],
      ['satellites' => ['Sentinel-1C" OR *:*']],
      ['satellites' => 'Sentinel-1C'],
    ] as $input) {
      try {
        $this->search->getState($input);
        self::fail('Invalid filter was accepted.');
      }
      catch (BadRequestHttpException $exception) {
        self::assertSame(400, $exception->getStatusCode());
      }
    }
  }

  /**
   * Tests mandatory filters and one selected region are never omitted.
   */
  public function testRegionalQuery(): void {
    foreach (array_keys(MosaicSearch::REGIONS) as $region) {
      $state = $this->search->getState([
        'region' => $region,
        'missions' => ['Sentinel-1'],
        'satellites' => ['Sentinel-1C'],
      ]);
      $query = $this->search->createQuery($state);
      self::assertSame('collection:NBS', $query->getFilterQuery('collection')->getQuery());
      self::assertSame('metadata_status:Active', $query->getFilterQuery('active')->getQuery());
      self::assertSame('data_access_url_ogc_wms:[* TO *]', $query->getFilterQuery('wms')->getQuery());
      self::assertSame('platform_sentinel:("Sentinel-1")', $query->getFilterQuery('missions')->getQuery());
      self::assertSame('platform_name_facet:("Sentinel-1C")', $query->getFilterQuery('satellites')->getQuery());
      self::assertSame(1500, $query->getRows());
      [$west, $south, $east, $north] = $state['bbox'];
      self::assertSame(
        "bbox:\"Intersects(ENVELOPE($west, $east, $north, $south))\"",
        $query->getFilterQuery('region')->getQuery(),
      );
    }
    $query = $this->search->createQuery($this->search->getState(['submitted' => '1']));
    self::assertSame('-*:*', $query->getFilterQuery('missions')->getQuery());
  }

  /**
   * Tests upstream search errors remain explicit rather than empty successes.
   */
  public function testSearchFailure(): void {
    $this->connector->method('execute')->willThrowException(new SearchApiSolrException('Unavailable'));
    $result = $this->search->search($this->search->getState([]));
    self::assertTrue($result['error']);
    self::assertSame([], $result['products']);
  }

  /**
   * Tests scalar and array Solr fields share the same output contract.
   */
  public function testNormalizeProduct(): void {
    $document = [
      'id' => 'test',
      'title' => ['Test product'],
      'data_access_url_ogc_wms' => ['https://example.org/wms?dataset=test'],
      'temporal_extent_start_date' => ['2026-10-22T12:00:00Z'],
      'geographic_extent_rectangle_west' => [10],
      'geographic_extent_rectangle_south' => 70,
      'geographic_extent_rectangle_east' => 20,
      'geographic_extent_rectangle_north' => 80,
    ];
    $product = $this->search->normalizeDocument($document);
    self::assertSame([10.0, 70.0, 20.0, 80.0], $product['bbox']);
    self::assertSame($product['start'], $product['end']);
    self::assertSame('https://example.org/wms?dataset=test', $product['resources'][0]['url']);
    $document['data_access_url_ogc_wms'] = ['javascript:alert(1)'];
    self::assertNull($this->search->normalizeDocument($document));
    $document['data_access_url_ogc_wms'] = 'https://example.org/wms';
    $document['geographic_extent_rectangle_south'] = 85;
    self::assertNull($this->search->normalizeDocument($document));
  }

}
