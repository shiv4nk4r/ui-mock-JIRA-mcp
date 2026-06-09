/**
 * mockCode.js — Tricky test fixture for the parsing engine.
 *
 * Exercises:
 *  - ES module imports (named, default, aliased)
 *  - Class with static and instance methods, inheritance
 *  - Nested functions (closures) inside methods
 *  - Arrow function variables
 *  - Async functions with await
 *  - Cross-function calls (A calls B, B calls C)
 *  - Dynamic (lazy) import()
 *  - Default export — Vue-like options object
 *  - Destructured params, rest params
 *  - Immediately Invoked Function Expression (IIFE)
 *  - Re-exported identifiers
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import { formatDate, parseISO }   from 'date-fns';
import axios                      from 'axios';
import { mapGetters, mapActions } from 'vuex';
import EventEmitter               from 'events';

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Validates a warehouse slot ID against a known pattern.
 * A ← called by fetchSlotData and WarehouseManager.init
 */
export function validateSlotId(slotId) {
  if (!slotId || typeof slotId !== 'string') return false;
  return /^[A-Z]{2}-\d{3}-\d{2}$/.test(slotId);
}

/**
 * Formats a millisecond timestamp for the UI.
 * B ← called by buildOrderSummary and inside formatSlotReport
 */
export function formatTimestamp(ms, locale = 'en-US') {
  const date = parseISO(new Date(ms).toISOString());
  return formatDate(date, 'dd MMM yyyy HH:mm', { locale });
}

/**
 * Builds an order summary object.
 * C ← calls formatTimestamp; called by WarehouseManager.processOrders
 */
export async function buildOrderSummary({ orders, warehouseId }) {
  const summaries = await Promise.all(
    orders.map(async (order) => {
      const ts = formatTimestamp(order.createdAt);    // calls B
      const isValid = validateSlotId(order.slotId);  // calls A
      return { id: order.id, ts, isValid, warehouseId };
    })
  );
  return summaries;
}

// ── Arrow function variable ───────────────────────────────────────────────────

const normalizeStatus = (status) =>
  status?.trim().toLowerCase().replace(/\s+/g, '_') ?? 'unknown';

// ── Closure / nested function ─────────────────────────────────────────────────

export function createRateLimiter(maxRps) {
  let count   = 0;
  let windowStart = Date.now();

  // inner function — should produce a nested function node
  function checkLimit() {
    const now = Date.now();
    if (now - windowStart > 1000) {
      count      = 0;
      windowStart = now;
    }
    count++;
    return count <= maxRps;
  }

  // another nested arrow
  const reset = () => { count = 0; windowStart = Date.now(); };

  return { checkLimit, reset };
}

// ── Class hierarchy ───────────────────────────────────────────────────────────

class BaseManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this._cache = new Map();
  }

  /** D — called by WarehouseManager.init */
  async _fetchConfig(endpoint) {
    const { data } = await axios.get(endpoint);
    return data;
  }

  static fromJSON(json) {
    return new BaseManager(JSON.parse(json));
  }
}

export class WarehouseManager extends BaseManager {
  #orders = [];  // private class field

  constructor(config) {
    super(config);
    this.warehouseId = config.warehouseId;
  }

  /** E — calls _fetchConfig (D), validateSlotId (A) */
  async init() {
    const cfg = await this._fetchConfig(this.config.endpoint);  // calls D
    if (!validateSlotId(cfg.defaultSlot)) {                     // calls A
      throw new Error('Invalid default slot in config');
    }
    this.emit('initialized', { warehouseId: this.warehouseId });
  }

  /** F — calls buildOrderSummary (C) */
  async processOrders(rawOrders) {
    const summaries = await buildOrderSummary({                 // calls C
      orders:      rawOrders,
      warehouseId: this.warehouseId,
    });
    this.#orders = summaries;
    return summaries;
  }

  /** G — calls normalizeStatus (arrow fn) + formatTimestamp (B) */
  formatSlotReport({ slotId, status, lastUpdated }) {
    const normStatus = normalizeStatus(status);                  // calls arrow
    const ts         = formatTimestamp(lastUpdated);             // calls B
    return `[${slotId}] ${normStatus} @ ${ts}`;
  }

  get orderCount() {
    return this.#orders.length;
  }

  static async create(config) {
    const mgr = new WarehouseManager(config);
    await mgr.init();
    return mgr;
  }
}

// ── Dynamic / lazy import ─────────────────────────────────────────────────────

export async function loadHeavyPlugin(name) {
  // Dynamic import — produces a 'uses' edge in Vue components
  const { default: Plugin } = await import(`./plugins/${name}`);
  return new Plugin();
}

// ── IIFE ─────────────────────────────────────────────────────────────────────

const _singletonRegistry = (() => {
  const registry = new Map();
  return {
    register:   (key, val) => registry.set(key, val),
    lookup:     (key)      => registry.get(key),
    listKeys:   ()         => [...registry.keys()],
  };
})();

// ── Re-export ─────────────────────────────────────────────────────────────────
export { normalizeStatus };

// ── Vue-style default export (tests the vue-component path even in .js) ───────

export default {
  name: 'WarehouseDashboard',
  components: {
    SlotGrid:     () => import('./components/SlotGrid.vue'),
    OrderSummary: () => import('./components/OrderSummary.vue'),
  },
  props: {
    warehouseId: { type: String, required: true },
    readOnly:    { type: Boolean, default: false },
  },
  data() {
    return {
      manager:     null,
      orders:      [],
      isLoading:   false,
      errorMsg:    null,
    };
  },
  computed: {
    hasOrders()   { return this.orders.length > 0; },
    orderCount()  { return this.orders.length; },
  },
  methods: {
    async fetchOrders() {
      this.isLoading = true;
      try {
        this.orders = await this.manager.processOrders([]); // calls F
      } finally {
        this.isLoading = false;
      }
    },
    formatReport(slot) {
      return this.manager?.formatSlotReport(slot) ?? '';    // calls G
    },
  },
  mixins: [mapGetters, mapActions],
  apollo: {
    warehouseData: { query: () => null },
  },
};
