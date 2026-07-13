import type { NavContext } from "./nav";
export const shiftPlannerTemplate = (ticketId: string, summary: string, navCtx: NavContext, navHtml: string) => `
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
    .section-banner .stat { font-size: 11px; font-weight: 400; opacity: 0.8; }
    .section-banner .stat span { font-weight: 700; font-size: 13px; opacity: 1; }
    .shift-morning { background: #e3f2fd; border-radius: 3px; padding: 2px 6px; font-size: 11px; color: #1565c0; }
    .shift-afternoon { background: #e8f5e9; border-radius: 3px; padding: 2px 6px; font-size: 11px; color: #2e7d32; }
    .shift-night { background: #fce4ec; border-radius: 3px; padding: 2px 6px; font-size: 11px; color: #880e4f; }
    .shift-empty { color: #bdbdbd; font-size: 11px; }
  </style>
</head>
<body>
<div id="app">
  <q-layout view="hHh lpr lfr">

    <q-header>
      ${navHtml}
      <div class="section-banner">
        ${navCtx.pageTitle}
        <span class="stat">Total Staff: <span>{{ totalStaff }}</span></span>
        <span class="stat">Assigned: <span style="color:#66bb6a">{{ assigned }}</span></span>
        <span class="stat">Open: <span style="color:#f9b115">{{ totalStaff - assigned }}</span></span>
        <span class="stat">Zones: <span>{{ shifts.length }}</span></span>
      </div>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">

        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pa-sm row items-center bg-grey-1">
            <q-tabs v-model="dayTab" dense align="left" indicator-color="secondary" style="color:#101a5c">
              <q-tab v-for="d in days" :key="d" :name="d" :label="d" style="font-size:12px;min-height:32px;" />
            </q-tabs>
            <q-space />
            <q-btn unelevated color="secondary" icon="add" label="Add Shift" size="sm" />
            <q-btn flat color="dark" icon="file_download" label="Export" size="sm" class="q-ml-sm" />
          </q-card-section>

          <q-table
            flat
            dense
            :data="shifts"
            :columns="columns"
            row-key="zone"
            hide-bottom
          >
            <template v-slot:header="props">
              <q-tr :props="props" class="bg-grey-2">
                <q-th v-for="col in props.cols" :key="col.name" :props="props"
                  style="font-size:13px; font-weight:600; color:#636f83; text-align:left;">
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td key="zone" :props="props">
                  <q-chip dense style="background:#101a5c; color:#fff; font-size:11px;">{{ props.row.zone }}</q-chip>
                </q-td>
                <q-td key="morning" :props="props">
                  <span class="shift-morning" v-if="props.row.morning">
                    <q-icon name="person" size="11px" /> {{ props.row.morning }}
                  </span>
                  <span class="shift-empty" v-else>Unassigned</span>
                </q-td>
                <q-td key="afternoon" :props="props">
                  <span class="shift-afternoon" v-if="props.row.afternoon">
                    <q-icon name="person" size="11px" /> {{ props.row.afternoon }}
                  </span>
                  <span class="shift-empty" v-else>Unassigned</span>
                </q-td>
                <q-td key="night" :props="props">
                  <span class="shift-night" v-if="props.row.night">
                    <q-icon name="person" size="11px" /> {{ props.row.night }}
                  </span>
                  <span class="shift-empty" v-else>Unassigned</span>
                </q-td>
                <q-td key="headcount" :props="props" style="font-size:13px; font-weight:700; color:#101a5c;">
                  {{ props.row.headcount }}
                </q-td>
                <q-td key="status" :props="props">
                  <q-chip dense :color="props.row.full ? 'positive' : 'warning'" text-color="white" size="sm">
                    {{ props.row.full ? 'Full Coverage' : 'Partial' }}
                  </q-chip>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </q-card>

        <div class="row q-gutter-sm">
          <q-btn unelevated color="secondary" icon="save" label="Save Schedule" />
          <q-btn flat color="dark" icon="undo" label="Reset" />
        </div>

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
      dayTab: 'Mon',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      totalStaff: 24,
      assigned: 18,
      columns: [
        { name: 'zone', label: 'Zone', field: 'zone', align: 'left' },
        { name: 'morning', label: 'Morning (06:00–14:00)', field: 'morning', align: 'left' },
        { name: 'afternoon', label: 'Afternoon (14:00–22:00)', field: 'afternoon', align: 'left' },
        { name: 'night', label: 'Night (22:00–06:00)', field: 'night', align: 'left' },
        { name: 'headcount', label: 'Headcount', field: 'headcount', align: 'left' },
        { name: 'status', label: 'Coverage', field: 'full', align: 'left' },
      ],
      shifts: [
        { zone: 'GTP-A', morning: 'R. Kumar (4)', afternoon: 'S. Patel (3)', night: null, headcount: 7, full: false },
        { zone: 'GTP-B', morning: 'A. Singh (5)', afternoon: 'T. Mehta (5)', night: 'K. Das (2)', headcount: 12, full: true },
        { zone: 'Reserve', morning: 'S. Sharma (3)', afternoon: null, night: null, headcount: 3, full: false },
        { zone: 'Outbound', morning: 'V. Nair (4)', afternoon: 'M. Rao (4)', night: 'L. Iyer (3)', headcount: 11, full: true },
        { zone: 'Inbound', morning: 'D. Gupta (3)', afternoon: 'H. Verma (3)', night: null, headcount: 6, full: false },
      ],
    };
  },
});
<\/script>
</body>
</html>
`;
