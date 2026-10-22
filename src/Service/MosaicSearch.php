<?php

declare(strict_types=1);

namespace Drupal\mosaic\Service;

use Drupal\search_api_solr\SearchApiSolrException;
use Solarium\QueryType\Select\Query\Query;
use Drupal\Component\Datetime\TimeInterface;
use Drupal\metsis_drupal\Service\SolrConnectorProvider;
use Drupal\metsis_drupal\Service\SolrQueryFactory;
use Psr\Log\LoggerInterface;
use Solarium\Exception\ExceptionInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Queries active, WMS-enabled NBS products using METSIS infrastructure.
 */
final class MosaicSearch {

  public const REGIONS = [
    'svalbard' => ['label' => 'Svalbard', 'bbox' => [-2.22, 72.70, 52.29, 82.21]],
    'north' => ['label' => 'Northern Norway', 'bbox' => [5.00, 65.55, 39.25, 70.84]],
    'south' => ['label' => 'Southern Norway', 'bbox' => [-1.70, 56.42, 20.42, 66.74]],
  ];

  public const MISSIONS = ['Sentinel-1', 'Sentinel-2'];

  public const LIMIT = 1500;

  /**
   * Constructs the query service.
   */
  public function __construct(
    private readonly SolrQueryFactory $queryFactory,
    private readonly SolrConnectorProvider $connectorProvider,
    private readonly TimeInterface $time,
    private readonly LoggerInterface $logger,
  ) {}

  /**
   * Validates and normalizes URL filters.
   */
  public function getState(array $input): array {
    $today = gmdate('Y-m-d', $this->time->getRequestTime());
    $region = $input['region'] ?? 'svalbard';
    $date = $input['date'] ?? $today;
    if (!is_string($region) || !isset(self::REGIONS[$region])) {
      throw new BadRequestHttpException('Invalid Mosaic region.');
    }
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) {
      throw new BadRequestHttpException('Invalid Mosaic date.');
    }
    $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date, new \DateTimeZone('UTC'));
    if (!$parsed || $parsed->format('Y-m-d') !== $date || $date > $today) {
      throw new BadRequestHttpException('Invalid Mosaic date.');
    }
    $missions = $input['missions'] ?? (isset($input['submitted']) ? [] : self::MISSIONS);
    $satellites = $input['satellites'] ?? [];
    if (!is_array($missions) || count($missions) > 2 || !is_array($satellites) || count($satellites) > 26) {
      throw new BadRequestHttpException('Invalid Mosaic satellite filters.');
    }
    foreach ($missions as $mission) {
      if (!is_string($mission) || !in_array($mission, self::MISSIONS, TRUE)) {
        throw new BadRequestHttpException('Invalid Mosaic mission.');
      }
    }
    foreach ($satellites as $satellite) {
      if (!is_string($satellite) || !preg_match('/^Sentinel-[12][A-Z]$/D', $satellite)) {
        throw new BadRequestHttpException('Invalid Mosaic satellite.');
      }
    }
    $end = $date === $today ? $this->time->getRequestTime() : $parsed->modify('+1 day')->getTimestamp() - 1;
    $start = $date === $today ? $end - 86400 : $parsed->getTimestamp();
    return [
      'region' => $region,
      'bbox' => self::REGIONS[$region]['bbox'],
      'date' => $date,
      'today' => $today,
      'start' => gmdate('Y-m-d\TH:i:s\Z', $start),
      'end' => gmdate('Y-m-d\TH:i:s\Z', $end),
      'missions' => array_values(array_unique($missions)),
      'satellites' => array_values(array_unique($satellites)),
    ];
  }

  /**
   * Builds one regional query, with explicit status and resource predicates.
   */
  public function createQuery(array $state): Query {
    $query = $this->queryFactory->createSelectQuery();
    $query->setQuery('*:*')->setRows(self::LIMIT);
    $query->setFields([
      'id', 'title', 'temporal_extent_start_date', 'temporal_extent_end_date',
      'data_access_url_ogc_wms',
      'geographic_extent_rectangle_north', 'geographic_extent_rectangle_south',
      'geographic_extent_rectangle_west', 'geographic_extent_rectangle_east',
    ]);
    [$west, $south, $east, $north] = $state['bbox'];
    $filters = [
      'collection' => 'collection:NBS',
      'active' => 'metadata_status:Active',
      'wms' => 'data_access_url_ogc_wms:[* TO *]',
      'supported' => 'platform_sentinel:("Sentinel-1" OR "Sentinel-2")',
      'region' => "bbox:\"Intersects(ENVELOPE($west, $east, $north, $south))\"",
      'time' => 'temporal_extent_start_date:[' . $state['start'] . ' TO ' . $state['end'] . ']',
      'missions' => $state['missions'] === [] ? '-*:*' : 'platform_sentinel:(' . implode(' OR ', array_map(
        static fn(string $value): string => '"' . $value . '"', $state['missions'],
      )) . ')',
    ];
    if ($state['satellites'] !== []) {
      $filters['satellites'] = 'platform_name_facet:(' . implode(' OR ', array_map(
        static fn(string $value): string => '"' . $value . '"', $state['satellites'],
      )) . ')';
    }
    foreach ($filters as $key => $filter) {
      $query->createFilterQuery($key)->setQuery($filter)->setTags([$key]);
    }
    $query->addSort('temporal_extent_start_date', 'desc')->addSort('id', 'asc');
    $query->getFacetSet()->createFacetField('satellites')
      ->setField('platform_name_facet')->setMinCount(1)->setLimit(26)
      ->setExcludes(['satellites', 'missions']);
    return $query;
  }

  /**
   * Executes the query, surfacing connection errors and incomplete results.
   */
  public function search(array $state): array {
    $response = ['products' => [], 'satellites' => [], 'total' => 0, 'invalid' => 0, 'error' => FALSE];
    try {
      $result = $this->connectorProvider->getConnector()->execute($this->createQuery($state));
      $response['total'] = $result->getNumFound();
      foreach ($result as $document) {
        $product = $this->normalizeDocument($document->getFields());
        if ($product !== NULL) {
          $response['products'][] = $product;
        }
        else {
          $response['invalid']++;
        }
      }
      foreach ($result->getFacetSet()->getFacet('satellites') as $name => $count) {
        if (preg_match('/^Sentinel-[12][A-Z]$/D', (string) $name)) {
          $response['satellites'][] = (string) $name;
        }
      }
      sort($response['satellites']);
      if ($response['invalid']) {
        $this->logger->warning('Mosaic skipped @count documents with invalid WMS, bbox or time fields.', ['@count' => $response['invalid']]);
      }
    }
    catch (ExceptionInterface | SearchApiSolrException | \RuntimeException $exception) {
      $this->logger->error('Mosaic search failed: @error', ['@error' => $exception->getMessage()]);
      $response['products'] = [];
      $response['error'] = TRUE;
    }
    return $response;
  }

  /**
   * Normalizes Solr's scalar and multivalue fields for the map contract.
   */
  public function normalizeDocument(array $document): ?array {
    $values = static fn(mixed $value): array => array_values(array_filter(
      is_array($value) ? $value : [$value], 'is_scalar',
    ));
    $first = static fn(string $field): mixed => $values($document[$field] ?? [])[0] ?? NULL;
    $resources = [];
    foreach ($values($document['data_access_url_ogc_wms'] ?? []) as $url) {
      if (is_string($url) && filter_var($url, FILTER_VALIDATE_URL)
        && in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], TRUE)) {
        $resources[] = ['url' => $url, 'layers' => []];
      }
    }
    $bbox = array_map($first, [
      'geographic_extent_rectangle_west', 'geographic_extent_rectangle_south',
      'geographic_extent_rectangle_east', 'geographic_extent_rectangle_north',
    ]);
    $start = $first('temporal_extent_start_date');
    $end = $first('temporal_extent_end_date') ?? $start;
    if (!$resources || !$first('id') || count(array_filter($bbox, 'is_numeric')) !== 4 || !is_string($start) || !is_string($end) || strtotime($start) === FALSE || strtotime($end) === FALSE) {
      return NULL;
    }
    $bbox = array_map('floatval', $bbox);
    if ($bbox[0] < -180 || $bbox[2] > 180 || $bbox[1] < -90 || $bbox[3] > 90 || $bbox[0] >= $bbox[2] || $bbox[1] >= $bbox[3] || strtotime($start) > strtotime($end)) {
      return NULL;
    }
    return [
      'id' => (string) $first('id'),
      'title' => (string) ($first('title') ?? $first('id')),
      'bbox' => $bbox,
      'start' => $start,
      'end' => $end,
      'resources' => $resources,
    ];
  }

}
