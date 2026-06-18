import type { NavContext } from "./nav";
export const exceptionListingTemplate = (ticketId: string, summary: string, navCtx: NavContext, navHtml: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.quasar.dev/1.20.1/quasar.min.css" rel="stylesheet" />
  <link href="https://cdn.quasar.dev/icon/material-icons/material-icons.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/vue@2.7.14/dist/vue.min.js"><\/script>
  <script src="https://cdn.quasar.dev/1.20.1/quasar.umd.min.js"><\/script>
  <style>
    body { font-family: Roboto, sans-serif; background: #F5F5F5; padding: 0; margin: 0; }
    .section-banner { background: #101a5c; color: #fff; padding: 8px 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 24px; }
    .section-banner .stat span { font-weight: 700; }
    .filter-bar { background: #fff; border-bottom: 1px solid #d4d3d3; padding: 8px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  </style>
</head>
<body>
<div id="app">
  <q-layout view="hHh lpr lfr">

    <q-header>
      ${navHtml}
      <div class="section-banner">
        ${navCtx.pageTitle}
        <span class="stat">Total: <span>{{ rows.length }}</span></span>
        <span class="stat">Critical: <span style="color:#ED3324">{{ rows.filter(r => r.priority === 'Critical').length }}</span></span>
        <span class="stat">Open: <span style="color:#f9b115">{{ rows.filter(r => r.status === 'Open').length }}</span></span>
      </div>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">

        <q-card flat bordered class="q-mb-sm">
          <q-card-section class="q-pa-sm row items-center q-gutter-sm">
            <q-input
              dense outlined v-model="search"
              placeholder="Search by SKU ID, Order ID..."
              style="min-width:220px;"
            >
              <template v-slot:prepend><q-icon name="search" /></template>
            </q-input>

            <q-select dense outlined v-model="priorityFilter" :options="priorityOptions"
              label="Priority" style="min-width:140px;" clearable />

            <q-select dense outlined v-model="statusFilter" :options="statusOptions"
              label="Status" style="min-width:140px;" clearable />

            <q-space />
            <q-btn unelevated color="secondary" icon="file_download" label="Export" size="sm" />
            <q-btn flat color="dark" icon="refresh" label="Refresh" size="sm" />
          </q-card-section>
        </q-card>

        <q-card flat bordered>
          <q-table
            flat dense
            :data="filteredRows"
            :columns="columns"
            row-key="id"
            :pagination.sync="pagination"
          >
            <template v-slot:header="props">
              <q-tr :props="props" class="bg-grey-2">
                <q-th v-for="col in props.cols" :key="col.name" :props="props"
                  style="font-size:13px; font-weight:600; color:#636f83;">
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td key="id" :props="props">
                  <span style="color:#2982cc; cursor:pointer; text-decoration:underline; font-size:13px;">
                    {{ props.row.id }}
                  </span>
                </q-td>
                <q-td key="sku" :props="props" style="font-size:13px;">{{ props.row.sku }}</q-td>
                <q-td key="type" :props="props" style="font-size:13px;">{{ props.row.type }}</q-td>
                <q-td key="zone" :props="props" style="font-size:13px;">{{ props.row.zone }}</q-td>
                <q-td key="priority" :props="props">
                  <q-chip dense :color="priorityColor(props.row.priority)" text-color="white" size="sm">
                    {{ props.row.priority }}
                  </q-chip>
                </q-td>
                <q-td key="status" :props="props">
                  <q-chip dense :color="statusColor(props.row.status)" text-color="white" size="sm">
                    {{ props.row.status }}
                  </q-chip>
                </q-td>
                <q-td key="createdAt" :props="props" style="font-size:12px; color:#636f83;">
                  {{ props.row.createdAt }}
                </q-td>
                <q-td key="actions" :props="props">
                  <q-btn flat round dense icon="more_vert" color="dark" size="sm">
                    <q-menu>
                      <q-list dense>
                        <q-item clickable v-close-popup><q-item-section>View Details</q-item-section></q-item>
                        <q-item clickable v-close-popup><q-item-section>Assign</q-item-section></q-item>
                        <q-item clickable v-close-popup><q-item-section style="color:#ED3324">Close</q-item-section></q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </q-card>

      </q-page>
    </q-page-container>
  </q-layout>
</div>

<script>
Vue.use(Quasar);
new Vue({
  el: '#app',
  data() {
    return {
      ticketId: '${ticketId}',
      activeTab: '${navCtx.activeTab}',
      activeSubTab: '${navCtx.activeSubTab}',
      search: '',
      priorityFilter: null,
      statusFilter: null,
      priorityOptions: ['Critical', 'High', 'Medium', 'Low'],
      statusOptions: ['Open', 'In Progress', 'Resolved', 'Closed'],
      pagination: { rowsPerPage: 8 },
      columns: [
        { name: 'id', label: 'Exception ID', field: 'id', align: 'left', sortable: true },
        { name: 'sku', label: 'SKU ID', field: 'sku', align: 'left', sortable: true },
        { name: 'type', label: 'Type', field: 'type', align: 'left' },
        { name: 'zone', label: 'Zone', field: 'zone', align: 'left' },
        { name: 'priority', label: 'Priority', field: 'priority', align: 'left', sortable: true },
        { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
        { name: 'createdAt', label: 'Created', field: 'createdAt', align: 'left', sortable: true },
        { name: 'actions', label: '', field: 'actions', align: 'center' },
      ],
      rows: [
        { id: 'EXC-1041', sku: 'SKU-88321', type: 'Mismatch', zone: 'GTP-A', priority: 'Critical', status: 'Open', createdAt: '2026-06-03 09:12' },
        { id: 'EXC-1040', sku: 'SKU-44102', type: 'Overstock', zone: 'Reserve', priority: 'High', status: 'In Progress', createdAt: '2026-06-03 08:45' },
        { id: 'EXC-1039', sku: 'SKU-99204', type: 'Missing', zone: 'GTP-B', priority: 'Medium', status: 'Open', createdAt: '2026-06-03 07:30' },
        { id: 'EXC-1038', sku: 'SKU-11534', type: 'Mismatch', zone: 'Outbound', priority: 'Low', status: 'Resolved', createdAt: '2026-06-02 18:00' },
        { id: 'EXC-1037', sku: 'SKU-55601', type: 'Damage', zone: 'Inbound', priority: 'High', status: 'Open', createdAt: '2026-06-02 16:15' },
        { id: 'EXC-1036', sku: 'SKU-72340', type: 'Overstock', zone: 'GTP-A', priority: 'Medium', status: 'Closed', createdAt: '2026-06-02 14:00' },
      ],
    };
  },
  computed: {
    filteredRows() {
      return this.rows.filter(r => {
        const matchSearch = !this.search || r.id.includes(this.search) || r.sku.includes(this.search);
        const matchPriority = !this.priorityFilter || r.priority === this.priorityFilter;
        const matchStatus = !this.statusFilter || r.status === this.statusFilter;
        return matchSearch && matchPriority && matchStatus;
      });
    },
  },
  methods: {
    priorityColor(p) {
      return { Critical: 'negative', High: 'warning', Medium: 'info', Low: 'dark' }[p] || 'dark';
    },
    statusColor(s) {
      return { Open: 'warning', 'In Progress': 'info', Resolved: 'positive', Closed: 'dark' }[s] || 'dark';
    },
  },
});
<\/script>
</body>
</html>
`;
