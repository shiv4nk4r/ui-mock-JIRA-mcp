import type { NavContext } from "./nav";
export const dashboardOverviewTemplate = (ticketId: string, summary: string, navCtx: NavContext, navHtml: string) => `
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
    .section-banner { background: #101a5c; color: #fff; padding: 8px 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 32px; }
    .section-banner .stat { font-size: 11px; opacity: 0.8; }
    .section-banner .stat span { font-weight: 700; font-size: 14px; opacity: 1; }
    .kpi-value { font-size: 22px; font-weight: 700; color: #101a5c; line-height: 1; }
    .kpi-label { font-size: 12px; color: #636f83; margin-top: 4px; }
    .kpi-delta-pos { font-size: 11px; color: #66bb6a; }
    .kpi-delta-neg { font-size: 11px; color: #ED3324; }
    .progress-bar-bg { background: #e0e0e0; border-radius: 4px; height: 6px; margin-top: 6px; }
    .progress-bar-fill { height: 6px; border-radius: 4px; }
  </style>
</head>
<body>
<div id="app">
  <q-layout view="hHh lpr lfr">

    <q-header>
      ${navHtml}
      <div class="section-banner">
        ${navCtx.pageTitle}
        <span class="stat">Throughput: <span>{{ throughput }} units/hr</span></span>
        <span class="stat">Utilisation: <span>{{ utilisation }}%</span></span>
        <span class="stat">Active Bots: <span>{{ activeBots }}/{{ totalBots }}</span></span>
      </div>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">

        <!-- KPI Row -->
        <div class="row q-gutter-md q-mb-md">
          <q-card v-for="kpi in kpis" :key="kpi.label" flat bordered style="min-width:140px; flex:1;">
            <q-card-section class="q-pa-md">
              <div class="row items-start no-wrap">
                <div class="col">
                  <div class="kpi-value">{{ kpi.value }}</div>
                  <div class="kpi-label">{{ kpi.label }}</div>
                  <div :class="kpi.delta > 0 ? 'kpi-delta-pos' : 'kpi-delta-neg'" class="q-mt-xs">
                    <q-icon :name="kpi.delta > 0 ? 'arrow_upward' : 'arrow_downward'" size="11px" />
                    {{ Math.abs(kpi.delta) }}% vs yesterday
                  </div>
                </div>
                <q-icon :name="kpi.icon" :color="kpi.color" size="28px" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Zone Utilisation + Recent Activity -->
        <div class="row q-gutter-md">

          <div class="col-12 col-md-5">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm row items-center bg-grey-1">
                <q-icon name="location_on" color="primary" size="18px" class="q-mr-sm" />
                <span style="font-size:13px; font-weight:600; color:#101a5c;">Zone Utilisation</span>
              </q-card-section>
              <q-card-section>
                <div v-for="zone in zones" :key="zone.name" class="q-mb-md">
                  <div class="row items-center q-mb-xs">
                    <span style="font-size:12px; font-weight:600; color:#101a5c; flex:1;">{{ zone.name }}</span>
                    <span style="font-size:12px; color:#636f83;">{{ zone.pct }}%</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill"
                      :style="{ width: zone.pct + '%', background: zone.pct > 85 ? '#ED3324' : zone.pct > 60 ? '#f9b115' : '#66bb6a' }">
                    </div>
                  </div>
                  <div style="font-size:11px; color:#636f83; margin-top:3px;">{{ zone.slots }} slots occupied / {{ zone.total }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm row items-center bg-grey-1">
                <q-icon name="history" color="primary" size="18px" class="q-mr-sm" />
                <span style="font-size:13px; font-weight:600; color:#101a5c;">Recent Activity</span>
                <q-space />
                <q-btn flat dense size="xs" label="View all" color="info" />
              </q-card-section>
              <q-list dense>
                <q-item v-for="(event, i) in events" :key="i">
                  <q-item-section avatar>
                    <q-icon :name="event.icon" :color="event.color" size="20px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label style="font-size:12px;">{{ event.message }}</q-item-label>
                    <q-item-label caption style="font-size:11px;">{{ event.time }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-chip dense :color="event.statusColor" text-color="white" size="sm">
                      {{ event.status }}
                    </q-chip>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>

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
      throughput: 342,
      utilisation: 78,
      activeBots: 12,
      totalBots: 15,
      kpis: [
        { label: 'Orders Processed', value: '1,842', delta: 5.2, icon: 'shopping_cart', color: 'info' },
        { label: 'Units Picked', value: '9,431', delta: 3.1, icon: 'inventory', color: 'positive' },
        { label: 'Exceptions Open', value: '14', delta: -8.3, icon: 'warning', color: 'negative' },
        { label: 'Avg Pick Time', value: '1.4m', delta: -2.0, icon: 'timer', color: 'secondary' },
      ],
      zones: [
        { name: 'GTP-A', pct: 91, slots: 182, total: 200 },
        { name: 'GTP-B', pct: 74, slots: 148, total: 200 },
        { name: 'Reserve', pct: 55, slots: 275, total: 500 },
        { name: 'Outbound', pct: 68, slots: 68, total: 100 },
        { name: 'Inbound', pct: 43, slots: 43, total: 100 },
      ],
      events: [
        { icon: 'check_circle', color: 'positive', message: 'Order #ORD-88231 dispatched from Outbound', time: '2 min ago', status: 'Completed', statusColor: 'positive' },
        { icon: 'warning', color: 'warning', message: 'Zone GTP-A nearing capacity (91%)', time: '5 min ago', status: 'Warning', statusColor: 'warning' },
        { icon: 'error', color: 'negative', message: 'Bot #07 offline — maintenance required', time: '12 min ago', status: 'Critical', statusColor: 'negative' },
        { icon: 'sync', color: 'info', message: 'Inbound batch #IB-4421 received (120 units)', time: '18 min ago', status: 'In Progress', statusColor: 'info' },
        { icon: 'check_circle', color: 'positive', message: 'Shift handover completed — Zone Reserve', time: '32 min ago', status: 'Completed', statusColor: 'positive' },
      ],
    };
  },
});
<\/script>
</body>
</html>
`;
