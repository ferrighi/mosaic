<?php

declare(strict_types=1);

namespace Drupal\mosaic\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Htmx\Htmx;
use Drupal\Core\Url;
use Drupal\mosaic\Service\MosaicSearch;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Displays the Mosaic map and its progressively enhanced search controls.
 */
final class MosaicController extends ControllerBase {

  /**
   * Constructs the controller.
   */
  public function __construct(
    private readonly MosaicSearch $search,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): self {
    return new self($container->get('mosaic.search'));
  }

  /**
   * Builds the page without overriding the active theme's page template.
   */
  public function render(Request $request): array {
    return [
      '#theme' => 'mosaic',
      '#results' => $this->results($request),
      '#attached' => ['library' => ['mosaic/mosaic']],
      '#cache' => ['max-age' => 0],
    ];
  }

  /**
   * Builds the filter form and result fragment for core HTMX.
   */
  public function results(Request $request): array {
    $state = $this->search->getState($request->query->all());
    $result = $this->search->search($state);
    $result['satellites'] = array_values(array_unique(array_merge($result['satellites'], $state['satellites'])));
    sort($result['satellites']);
    $attributes = (new Htmx())
      ->get(Url::fromRoute('mosaic.results'))
      ->target('#mosaic-results')
      ->swap('outerHTML')
      ->trigger('submit, change')
      ->sync('closest .mosaic:replace');
    $build = [
      '#theme' => 'mosaic_results',
      '#state' => $state,
      '#result' => $result,
      '#regions' => MosaicSearch::REGIONS,
      '#action' => Url::fromRoute('mosaic')->toString(),
      '#cache' => ['max-age' => 0],
    ];
    $form = [];
    $attributes->applyTo($form);
    $build['#form_attributes'] = $form['#attributes'];
    $build['#attached'] = $form['#attached'];
    return $build;
  }

}
