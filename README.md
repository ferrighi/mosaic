## Mosaic tool
Author: Lara Ferrighi, laraf@met.no
Author: Magnar Eivind Martinsen, magnarem@met.no

Drupal tool for displaying Sentinel products on an OpenLayers map.

Software metadata provided in the codemeta.json file. 

## Requirements and build

Mosaic requires Drupal 11.4+, the Vite contributed module, and the current
`metsis_drupal` module. The latter provides the Solr connector/query factory
and shared frontend WMS helpers. No ol-ext dependency is used.

Run the following from this module's root:

```sh
npm ci
npm run build
```

Commit the generated `dist/` assets and manifest when deploying the module
without a Node build step. Vite discovers METSIS in the sibling
`../metsis_drupal` directory or the local test site's
`web/modules/custom/metsis_drupal` directory. For another layout, set
`METSIS_DRUPAL_PATH` to the installed module directory before building.

For development, run `npm run dev` and clear Drupal's library cache. The
local library configuration probes `http://localhost:5173` and serves HMR
through `https://mosaic.ddev.site:5173`; adjust the Vite library/server
configuration for a different development hostname. Production uses the
manifest when the development server is not running.

The shared Vite development-client library also needs the browser-facing URL
in the test site's local settings, otherwise it defaults to the browser's
`http://localhost:5173`:

```php
$settings['vite']['devServerUrl'] = 'https://mosaic.ddev.site:5173';
$settings['vite']['devServerProbeUrl'] = 'http://localhost:5173';
```

For production, set `$settings['vite']['useDevServer'] = FALSE`.

The repository root is the module source. `web/` is only the local Drupal
test site. Its module directory must link new root files/directories as well
as existing ones (including `mosaic.services.yml` and `dist/`). Do not edit
test-site copies of module code.

## Search and map behavior

Open `/services/mosaic`. All queries are scoped to `collection:NBS`,
`metadata_status:Active`, a WMS URL, and Sentinel-1 or Sentinel-2. Only the
selected region is queried. The initial time interval is the preceding
24 hours of `temporal_extent_start_date`, meaning satellite recording time,
not ingestion time. Selecting a historical date shows that UTC day's
recordings. Mission and satellite checkboxes refine the query; selecting no
missions returns no products, while selecting no individual satellites means
all satellites in the selected missions.

The acquisition-start field intentionally remains the time predicate:
`temporal_extent_period_dr` intersection could include recordings starting
before the selected interval and would change that agreed meaning.

Core HTMX updates the server-rendered filter/results fragment. The map stays
mounted in the active theme's normal page layout; Mosaic does not override
the theme's page template. English and Norwegian use Drupal translation
rather than separate duplicated templates.

The map uses proj4's built-in EPSG:5041 definition and native OpenLayers
WebGL tiles. Canvas tiles and a visible notice provide graceful degradation
when WebGL is unavailable or its context is lost. WMS and basemap endpoints
must support CORS; Mosaic does not proxy external requests.

METSIS WMS helpers preserve endpoint-specific parameters, discover selectable
layers, and exclude `NBS`. Capabilities discovery has six concurrent workers;
imagery appears progressively. A common layer selector appears only when
every returned WMS resource resolves to the same nonempty selectable layer
set. Capability failures and tile failures are reported explicitly.

The native keyboard/touch date slider controls the end of a 1-, 6-, or
24-hour acquisition window. The initial selection is the full 24 hours.
The indeterminate activity bar tracks capability discovery and active WMS
tile requests; it does not claim a percentage with an unknown request total.

Product/region bbox intersections limit WMS layer extents before tile
selection, with sampled polar reprojection, no extra zoom-level preloading,
and no horizontal wrapping. Previous region layers stop rendering before a
switch; cached layers are retained up to 64 entries and parsed capabilities
up to 128 entries. Changing time does not refresh sources. Boundary tiles can
extend beyond the region, and already-started requests may still finish.
Panning is not restricted. Up to 1500 newest matching products are returned;
truncation and invalid map metadata are disclosed.

## Checks

```sh
npm test
npm run build
vendor/bin/phpcs src tests/src mosaic.module
vendor/bin/phpunit -c web/core/phpunit.xml.dist tests/src/Unit
```

The PHP tests use the local Drupal test site's autoloader. Check the page in
Olivero and Solo, including narrow layouts, HTMX filter updates, time
scrubbing, real WMS requests, and Canvas fallback.
