import type { NavContext } from "./nav";
export const alertListTemplate = (ticketId: string, summary: string, navCtx: NavContext, navHtml: string) => `
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
  </style>
</head>
<body>
<div id="app">
  <q-layout view="hHh lpr lfr">

    <q-header>
      ${navHtml}
      <div class="section-banner">
        ${navCtx.pageTitle}
        <span class="stat">Total: <span>{{ alerts.length }}</span></span>
        <span class="stat">Unread: <span style="color:#FE8400">{{ unreadCount }}</span></span>
        <span class="stat">Critical: <span style="color:#ED3324">{{ criticalCount }}</span></span>
      </div>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">

        <q-card flat bordered class="q-mb-sm">
          <q-card-section class="q-pa-sm row items-center q-gutter-sm">
            <q-btn-group flat>
              <q-btn flat :color="tab === 'all' ? 'secondary' : 'dark'" label="All" size="sm" @click="tab='all'" />
              <q-btn flat :color="tab === 'unread' ? 'secondary' : 'dark'" label="Unread" size="sm" @click="tab='unread'" />
              <q-btn flat :color="tab === 'critical' ? 'secondary' : 'dark'" label="Critical" size="sm" @click="tab='critical'" />
            </q-btn-group>
            <q-space />
            <q-btn flat color="dark" size="sm" icon="done_all" label="Mark all read" @click="markAllRead" />
            <q-btn flat color="dark" size="sm" icon="tune" label="Filter" />
          </q-card-section>
        </q-card>

        <q-card flat bordered>
          <q-list separator>
            <q-item v-for="alert in filteredAlerts" :key="alert.id" clickable v-ripple
              :class="{ 'bg-blue-1': !alert.read }">
              <q-item-section avatar>
                <q-avatar :color="alert.color" text-color="white" size="36px" icon-size="20px">
                  <q-icon :name="alert.icon" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label style="font-size:13px; font-weight:600; color:#101a5c;">
                  {{ alert.title }}
                  <q-chip v-if="!alert.read" dense color="secondary" text-color="white" size="xs" class="q-ml-xs">New</q-chip>
                </q-item-label>
                <q-item-label caption lines="2" style="font-size:12px; color:#636f83;">
                  {{ alert.description }}
                </q-item-label>
              </q-item-section>

              <q-item-section side top style="min-width:80px; text-align:right;">
                <q-item-label caption style="font-size:11px; color:#636f83;">{{ alert.time }}</q-item-label>
                <q-chip dense :color="alert.priority === 'Critical' ? 'negative' : alert.priority === 'High' ? 'warning' : 'info'"
                  text-color="white" size="xs" class="q-mt-xs">
                  {{ alert.priority }}
                </q-chip>
              </q-item-section>

              <q-item-section side>
                <q-btn flat round dense icon="more_vert" color="grey-5" size="sm">
                  <q-menu>
                    <q-list dense>
                      <q-item clickable v-close-popup @click="alert.read = true">
                        <q-item-section>Mark as read</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup>
                        <q-item-section>View Details</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup>
                        <q-item-section style="color:#ED3324">Dismiss</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
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
      tab: 'all',
      alerts: [
        { id: 1, title: 'Zone GTP-A Capacity Critical', description: 'Zone GTP-A has exceeded 90% storage capacity. Consider relocating inventory to Reserve zone immediately.', icon: 'warning', color: 'negative', priority: 'Critical', time: '2 min ago', read: false },
        { id: 2, title: 'Bot #07 Offline', description: 'Autonomous mobile robot #07 has gone offline in Zone GTP-B. Manual pick fallback activated.', icon: 'smart_toy', color: 'warning', priority: 'High', time: '8 min ago', read: false },
        { id: 3, title: 'Order SLA Breach — ORD-88440', description: 'Order #ORD-88440 has exceeded the promised SLA window by 22 minutes. Escalation required.', icon: 'schedule', color: 'negative', priority: 'Critical', time: '15 min ago', read: false },
        { id: 4, title: 'Inbound Batch Received', description: 'Inbound batch #IB-4421 containing 240 units has been received and is pending putaway assignment.', icon: 'inbox', color: 'info', priority: 'Low', time: '28 min ago', read: true },
        { id: 5, title: 'Shift Handover Completed', description: 'Morning shift handover for all zones completed successfully. No pending exceptions reported.', icon: 'people', color: 'positive', priority: 'Low', time: '1 hr ago', read: true },
        { id: 6, title: 'Inventory Audit Reminder', description: 'Scheduled inventory audit for Zone Reserve is due in 2 hours. Assign auditors before proceeding.', icon: 'fact_check', color: 'warning', priority: 'High', time: '2 hr ago', read: true },
      ],
    };
  },
  computed: {
    unreadCount() { return this.alerts.filter(a => !a.read).length; },
    criticalCount() { return this.alerts.filter(a => a.priority === 'Critical').length; },
    filteredAlerts() {
      if (this.tab === 'unread') return this.alerts.filter(a => !a.read);
      if (this.tab === 'critical') return this.alerts.filter(a => a.priority === 'Critical');
      return this.alerts;
    },
  },
  methods: {
    markAllRead() { this.alerts.forEach(a => a.read = true); },
  },
});
<\/script>
</body>
</html>
`;
