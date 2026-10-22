import Map from "ol/Map.js";
import View from "ol/View.js";
import WebGLTileLayer from "ol/layer/WebGLTile.js";
import TileLayer from "ol/layer/Tile.js";
import TileWMS from "ol/source/TileWMS.js";
import OSM from "ol/source/OSM.js";
import WMSCapabilities from "ol/format/WMSCapabilities.js";
import { register } from "ol/proj/proj4.js";
import { transformExtent } from "ol/proj.js";
import { unByKey } from "ol/Observable.js";
import proj4 from "proj4";
import {
  normalizeWmsResources, resolveWmsResource, getSharedLayerNames,
} from "@metsis-map/utils/wmsResources.js";
import { intersectBbox, timeWindow, overlaps, mapLimited } from "./map-utils.js";
import "ol/ol.css";
import "../css/mosaic_style.css";

proj4.defs("EPSG:5041");
register(proj4);

const instances = new WeakMap();
const projection = "EPSG:5041";
const t = Drupal.t;
const dateFormat = new Intl.DateTimeFormat(document.documentElement.lang || "en", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

class MosaicMap {
  constructor(root) {
    this.root = root;
    this.target = root.querySelector("[data-mosaic-map]");
    this.status = root.querySelector("[data-mosaic-status]");
    this.error = root.querySelector("[data-mosaic-error]");
    this.activity = root.querySelector("[data-mosaic-activity]");
    this.slider = root.querySelector("[data-mosaic-time]");
    this.window = root.querySelector("[data-mosaic-window]");
    this.layerSelect = root.querySelector("[data-mosaic-layer]");
    this.layerControl = root.querySelector("[data-mosaic-layer-control]");
    this.productList = root.querySelector("[data-mosaic-products]");
    this.layers = [];
    this.pending = new Set();
    this.tileLayers = new WeakMap();
    this.cachedLayers = new globalThis.Map();
    this.sourceListeners = [];
    this.capabilities = new globalThis.Map();
    this.webgl = this.canUseWebgl();
    this.basemap = new OSM({ crossOrigin: "anonymous", wrapX: false });
    this.baseLayer = this.makeLayer({ source: this.basemap });
    this.map = new Map({
      target: this.target,
      layers: [this.baseLayer],
      view: new View({ projection, center: [2000000, 2000000], zoom: 3 }),
    });
    this.map.on("singleclick", ({ pixel }) => {
      const hit = [...this.layers].sort((a, b) => b.layer.getZIndex() - a.layer.getZIndex()).find(({ layer }) => {
        if (!layer.getVisible()) return false;
        const data = layer.getData(pixel);
        return data && data[3] > 0;
      });
      const selected = root.querySelector("[data-mosaic-selected]");
      selected.replaceChildren();
      if (hit) selected.append(this.productLinks(hit.product));
    });
    this.controller = new AbortController();
    const options = { signal: this.controller.signal };
    this.slider.addEventListener("input", () => this.updateVisibility(), options);
    this.window.addEventListener("change", () => this.updateVisibility(), options);
    this.layerSelect.addEventListener("change", () => {
      this.layers.forEach(({ layer }) => layer.getSource().updateParams({
        LAYERS: this.layerSelect.value,
      }));
    }, options);
    root.addEventListener("htmx:beforeRequest", () => {
      this.clearProducts();
      this.status.textContent = t("Searching products…");
    }, options);
    root.addEventListener("htmx:responseError", () => this.showError(t("The product search failed. Please try again.")), options);
    root.addEventListener("htmx:sendError", () => this.showError(t("The product search could not be reached. Please try again.")), options);
    this.contextLost = (event) => {
      event.preventDefault();
      if (this.webgl) this.useCanvas();
    };
    this.target.addEventListener("webglcontextlost", this.contextLost, true);
    this.resize = new ResizeObserver(() => this.map.updateSize());
    this.resize.observe(this.target);
    if (!this.webgl) this.rendererNotice();
  }

  canUseWebgl() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  }

  makeLayer(options) {
    const Layer = this.webgl ? WebGLTileLayer : TileLayer;
    return new Layer({ preload: 0, cacheSize: 64, ...options });
  }

  rendererNotice() {
    const notice = this.root.querySelector("[data-mosaic-renderer]");
    notice.hidden = false;
    notice.textContent = t("WebGL is unavailable. The map is using Canvas rendering.");
  }

  useCanvas() {
    this.webgl = false;
    this.disposeCachedLayers();
    const replacements = [this.baseLayer, ...this.layers.map(({ layer }) => layer)];
    const converted = replacements.map((layer) => this.makeLayer({
      source: layer.getSource(), extent: layer.getExtent(),
      visible: layer.getVisible(), zIndex: layer.getZIndex(),
    }));
    replacements.forEach((layer) => {
      this.map.removeLayer(layer);
      layer.dispose();
    });
    converted.forEach((layer) => this.map.addLayer(layer));
    this.baseLayer = converted[0];
    this.layers.forEach((entry, i) => { entry.layer = converted[i + 1]; });
    this.sourceListeners.forEach(unByKey);
    this.sourceListeners = [];
    this.pending.clear();
    this.layers.forEach(({ layer }) => this.trackSource(layer.getSource(), layer));
    this.rendererNotice();
  }

  showError(message) {
    this.error.hidden = false;
    this.error.textContent = message;
  }

  clearProducts() {
    this.loadController?.abort();
    this.discovering = false;
    this.sourceListeners.forEach(unByKey);
    this.sourceListeners = [];
    this.layers.forEach((entry) => {
      const { layer, key } = entry;
      layer.setVisible(false);
      this.map.removeLayer(layer);
      this.cachedLayers.set(key, entry);
    });
    while (this.cachedLayers.size > 64) {
      const key = this.cachedLayers.keys().next().value;
      const entry = this.cachedLayers.get(key);
      this.cachedLayers.delete(key);
      entry.layer.getSource().dispose();
      entry.layer.dispose();
    }
    this.layers = [];
    this.pending.clear();
    this.activity.hidden = true;
    this.target.setAttribute("aria-busy", "false");
    this.status.textContent = "";
    this.productList.replaceChildren();
    this.root.querySelector("[data-mosaic-selected]").replaceChildren();
    this.layerControl.hidden = true;
  }

  disposeCachedLayers() {
    this.cachedLayers.forEach(({ layer }) => {
      layer.getSource().dispose();
      layer.dispose();
    });
    this.cachedLayers.clear();
  }

  async fetchCapabilities(url, signal) {
    if (this.capabilities.has(url)) return this.capabilities.get(url);
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) throw new Error(`WMS capabilities HTTP ${response.status}`);
    const parsed = new WMSCapabilities().read(await response.text());
    if (!parsed?.Capability?.Layer) throw new Error("Invalid WMS capabilities");
    signal.throwIfAborted();
    if (this.capabilities.size >= 128) this.capabilities.delete(this.capabilities.keys().next().value);
    this.capabilities.set(url, parsed);
    return parsed;
  }

  async update(fragment) {
    if (this.fragment === fragment) return;
    this.fragment = fragment;
    this.clearProducts();
    this.error.hidden = true;
    this.loadErrors = 0;
    const data = JSON.parse(fragment.querySelector("[data-mosaic-data]").textContent);
    this.state = data.state;
    this.products = data.products;
    const regionExtent = transformExtent(this.state.bbox, "EPSG:4326", projection, 32);
    if (this.region !== this.state.region) {
      this.map.getView().fit(regionExtent, { padding: [20, 20, 20, 20] });
      this.region = this.state.region;
    }
    this.slider.value = this.slider.max;
    this.renderTicks();
    this.updateVisibility();
    if (data.error || !data.products.length) return;
    this.loadController = new AbortController();
    const { signal } = this.loadController;
    this.discovering = true;
    this.activity.hidden = false;
    this.status.textContent = t("Discovering WMS layers…");
    const jobs = [];
    for (const product of this.products) {
      const bbox = intersectBbox(product.bbox, this.state.bbox);
      if (!bbox) continue;
      const resources = normalizeWmsResources({
        features: [{ properties: { wms_resources: product.resources } }],
      });
      for (const resource of resources) jobs.push({ product, bbox, resource });
    }
    try {
      const resolutions = await mapLimited(jobs, 6, async (job) => {
        signal.throwIfAborted();
        const result = await resolveWmsResource(job.resource, {
          blacklistedLayers: new Set(["nbs"]),
          preferredLayers: ["true_color_vegetation", "true_color", "amplitude_vv", "amplitude_hh"],
          signal,
          fetchCapabilities: (url, abortSignal) => this.fetchCapabilities(url, abortSignal),
        });
        signal.throwIfAborted();
        if (!result.error) {
          this.addProduct({ ...job, ...result });
          this.updateVisibility();
        }
        return { ...job, ...result };
      });
      signal.throwIfAborted();
      const failed = resolutions.filter((item) => item.error);
      if (failed.length) {
        console.error("Mosaic WMS capabilities failed", failed.map(({ resource, error }) => ({ url: resource.url, error })));
        this.showError(t("@count WMS resources could not be loaded. Check service availability and CORS support.", { "@count": failed.length }));
      }
      this.discovering = false;
      const names = getSharedLayerNames(resolutions);
      this.layerSelect.replaceChildren(...names.map((name) => new Option(name, name)));
      if (names.length) {
        this.layerSelect.value = resolutions[0].layerName;
        this.layers.forEach(({ layer }) => {
          if (layer.getSource().getParams().LAYERS !== this.layerSelect.value) {
            layer.getSource().updateParams({ LAYERS: this.layerSelect.value });
          }
        });
      }
      this.layerControl.hidden = names.length === 0;
      this.updateVisibility();
    } catch (error) {
      if (signal.aborted) return;
      console.error("Mosaic map failed", error);
      this.discovering = false;
      this.loadingStatus();
      this.showError(t("The map resources could not be loaded. Please try again."));
    }
  }

  addProduct(result) {
    const key = JSON.stringify([result.product.id, result.url, result.version]);
    const cached = this.cachedLayers.get(key);
    this.cachedLayers.delete(key);
    const source = cached?.layer.getSource() ?? new TileWMS({
      url: result.url,
      crossOrigin: "anonymous",
      wrapX: false,
      params: { LAYERS: result.layerName, VERSION: result.version, FORMAT: "image/png", TRANSPARENT: true },
    });
    if (source.getParams().LAYERS !== result.layerName) {
      source.updateParams({ LAYERS: result.layerName });
    }
    const layer = cached?.layer ?? this.makeLayer({ source, visible: false });
    layer.setZIndex(this.products.length - this.products.indexOf(result.product));
    layer.setExtent(transformExtent(result.bbox, "EPSG:4326", projection, 32));
    this.trackSource(source, layer);
    this.layers.push({ key, product: result.product, layer, layerNames: result.layerNames });
    this.map.addLayer(layer);
  }

  trackSource(source, layer) {
    this.sourceListeners.push(
      source.on("tileloadstart", ({ tile }) => {
        this.tileLayers.set(tile, layer);
        this.pending.add(tile);
        this.loadingStatus();
      }),
      source.on(["tileloadend", "tileloaderror"], (event) => {
        const tracked = this.pending.delete(event.tile);
        if (tracked && layer.getVisible() && event.type === "tileloaderror") {
          this.loadErrors++;
          this.showError(t("@count WMS tiles failed to load.", { "@count": this.loadErrors }));
        }
        this.loadingStatus();
      }),
    );
  }

  loadingStatus() {
    const pending = [...this.pending].filter((tile) => this.tileLayers.get(tile)?.getVisible()).length;
    const busy = this.discovering || pending > 0;
    this.activity.hidden = !busy;
    this.target.setAttribute("aria-busy", String(Boolean(busy)));
    this.status.textContent = this.discovering
      ? t("Discovering WMS layers…")
      : pending ? t("Loading WMS imagery…") : t("WMS loading is idle.");
  }

  renderTicks() {
    const minimum = Date.parse(this.state.start);
    const duration = Date.parse(this.state.end) - minimum;
    const ticks = [0, .25, .5, .75, 1];
    this.root.querySelector("[data-mosaic-ticks]").replaceChildren(...ticks.map((fraction) => {
      const span = document.createElement("span");
      span.textContent = dateFormat.format(new Date(minimum + fraction * duration));
      return span;
    }));
  }

  updateVisibility() {
    if (!this.state) return;
    const window = timeWindow(this.state, this.slider.value, this.window.value);
    const label = `${dateFormat.format(window[0])} – ${dateFormat.format(window[1])} UTC`;
    this.slider.setAttribute("aria-valuetext", label);
    this.root.querySelector("[data-mosaic-time-label]").textContent = label;
    const visible = new globalThis.Map();
    this.layers.forEach(({ product, layer }) => {
      const show = overlaps(product, window);
      layer.setVisible(show);
      if (show) visible.set(product.id, product);
    });
    this.loadingStatus();
    this.productList.replaceChildren(...[...visible.values()].map((product) => {
      const item = document.createElement("li");
      item.append(this.productLinks(product));
      return item;
    }));
  }

  productLinks(product) {
    const links = document.createElement("span");
    const metadata = document.createElement("a");
    metadata.href = Drupal.url(`metsis/metadata/${encodeURIComponent(product.id)}`);
    metadata.textContent = product.title;
    const wms = document.createElement("a");
    wms.href = Drupal.url(`metsis/wms/${encodeURIComponent(product.id)}`);
    wms.textContent = t("Explore WMS");
    links.append(metadata, document.createTextNode(" — "), wms);
    return links;
  }

  dispose() {
    this.clearProducts();
    this.disposeCachedLayers();
    this.controller.abort();
    this.resize.disconnect();
    this.target.removeEventListener("webglcontextlost", this.contextLost, true);
    this.map.setTarget(null);
    this.map.dispose();
  }
}

Drupal.behaviors.mosaic = {
  attach(context) {
    const roots = new Set([
      ...context.querySelectorAll("[data-mosaic]"),
      ...(context.closest?.("[data-mosaic]") ? [context.closest("[data-mosaic]")] : []),
    ]);
    for (const root of roots) {
      if (!instances.has(root)) instances.set(root, new MosaicMap(root));
      const instance = instances.get(root);
      const fragment = root.querySelector("[data-mosaic-results]");
      if (fragment) instance.update(fragment).catch((error) => {
        console.error("Mosaic initialization failed", error);
        instance.showError(t("The map could not be initialized."));
      });
    }
  },
  detach(context, settings, trigger) {
    if (trigger !== "unload") return;
    const roots = context.matches?.("[data-mosaic]") ? [context] : context.querySelectorAll("[data-mosaic]");
    for (const root of roots) {
      instances.get(root)?.dispose();
      instances.delete(root);
    }
  },
};
