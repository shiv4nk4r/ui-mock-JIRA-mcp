import type { NavContext } from "./nav";
export const formCardTemplate = (ticketId: string, summary: string, navCtx: NavContext, navHtml: string) => `
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
    .section-banner { background: #101a5c; color: #fff; padding: 8px 16px; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
<div id="app">
  <q-layout view="hHh lpr lfr">

    <q-header>
      ${navHtml}
      <div class="section-banner">${navCtx.pageTitle}</div>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">
        <div class="row q-gutter-md">

          <div class="col-12 col-md-7">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm row items-center bg-grey-1 q-mb-sm">
                <q-icon name="inventory_2" color="primary" class="q-mr-sm" />
                <span style="font-size:13px; font-weight:600; color:#101a5c;">Item Details</span>
              </q-card-section>

              <q-card-section>
                <q-form ref="form" class="q-gutter-md" @submit.prevent="submit">
                  <div class="row q-gutter-md">
                    <q-input
                      class="col"
                      dense outlined
                      v-model="form.skuId"
                      label="SKU ID *"
                      :rules="[val => !!val || 'SKU ID is required']"
                    />
                    <q-input
                      class="col"
                      dense outlined
                      v-model="form.orderId"
                      label="Order ID"
                    />
                  </div>

                  <div class="row q-gutter-md">
                    <q-select
                      class="col"
                      dense outlined
                      v-model="form.zone"
                      :options="zoneOptions"
                      label="Zone *"
                      :rules="[val => !!val || 'Zone is required']"
                    />
                    <q-select
                      class="col"
                      dense outlined
                      v-model="form.priority"
                      :options="priorityOptions"
                      label="Priority"
                    />
                  </div>

                  <q-input
                    dense outlined
                    type="number"
                    v-model.number="form.quantity"
                    label="Quantity *"
                    :rules="[val => val > 0 || 'Enter a valid quantity']"
                  />

                  <q-input
                    dense outlined
                    type="textarea"
                    v-model="form.notes"
                    label="Notes"
                    rows="3"
                  />

                  <div class="row q-gutter-sm q-mt-sm">
                    <q-checkbox v-model="form.urgent" label="Flag as Urgent" color="negative" />
                    <q-checkbox v-model="form.notify" label="Notify Supervisor" color="primary" />
                  </div>

                  <q-separator />

                  <div class="row q-gutter-sm">
                    <q-btn unelevated color="secondary" type="submit" label="Submit" icon="check" :disable="submitting" />
                    <q-btn flat color="dark" label="Reset" icon="undo" @click="reset" />
                  </div>
                </q-form>
              </q-card-section>
            </q-card>
          </div>

          <div class="col">
            <q-card flat bordered class="q-mb-md">
              <q-card-section class="q-pa-sm row items-center bg-grey-1">
                <q-icon name="info" color="info" class="q-mr-sm" />
                <span style="font-size:13px; font-weight:600; color:#101a5c;">Validation Status</span>
              </q-card-section>
              <q-card-section>
                <q-list dense>
                  <q-item v-for="check in validationChecks" :key="check.label">
                    <q-item-section avatar>
                      <q-icon :name="check.pass ? 'check_circle' : 'radio_button_unchecked'"
                        :color="check.pass ? 'positive' : 'grey-5'" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label style="font-size:12px;">{{ check.label }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>

            <q-card flat bordered v-if="submitted">
              <q-card-section class="text-center q-pa-md">
                <q-icon name="check_circle" color="positive" size="40px" />
                <div style="color:#2e7d32; font-weight:600; margin-top:8px;">Submitted Successfully</div>
                <div style="font-size:12px; color:#636f83; margin-top:4px;">Ref: #{{ refId }}</div>
              </q-card-section>
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
      summary: '${summary.slice(0, 55)}${summary.length > 55 ? "…" : ""}',
      submitting: false,
      submitted: false,
      refId: null,
      form: { skuId: '', orderId: '', zone: null, priority: 'Medium', quantity: 1, notes: '', urgent: false, notify: true },
      zoneOptions: ['GTP-A', 'GTP-B', 'Reserve', 'Outbound', 'Inbound'],
      priorityOptions: ['Critical', 'High', 'Medium', 'Low'],
    };
  },
  computed: {
    validationChecks() {
      return [
        { label: 'SKU ID provided', pass: !!this.form.skuId },
        { label: 'Zone selected', pass: !!this.form.zone },
        { label: 'Quantity > 0', pass: this.form.quantity > 0 },
        { label: 'Priority set', pass: !!this.form.priority },
      ];
    },
  },
  methods: {
    async submit() {
      const valid = await this.$refs.form.validate();
      if (!valid) return;
      this.submitting = true;
      setTimeout(() => {
        this.submitted = true;
        this.refId = Math.floor(Math.random() * 90000) + 10000;
        this.submitting = false;
      }, 800);
    },
    reset() {
      this.form = { skuId: '', orderId: '', zone: null, priority: 'Medium', quantity: 1, notes: '', urgent: false, notify: true };
      this.submitted = false;
      this.$refs.form.resetValidation();
    },
  },
});
<\/script>
</body>
</html>
`;
