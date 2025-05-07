<script setup lang="ts">
const sdk = useSDK();
import { useSDK } from "@/plugins/sdk";
import { ref, onMounted } from "vue";
import Button from "primevue/button";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import Settings from "./Settings.vue";
import ReceivedMessages from "./ReceivedMessages.vue";
import { useToast } from "primevue/usetoast";
import Toast from "primevue/toast";
import { useDrop } from "@/plugins/drop";
import DropToast from "@/components/DropToast.vue";
import { logger } from "@/utils/logger";
const activeTab = ref(0);
const toast = useToast();
const { initializeDrop} = useDrop();
logger.log("[App] SDK", sdk);
// Initialize the plugin when the app mounts

onMounted(async () => {
  initializeDrop(toast);
  logger.log("[App] Initializing");
  const storage = await sdk.storage.get();
  logger.log("[App] Storage", storage);
  if (storage.firstOpen) {
    activeTab.value = 1;
  }
});
</script>

<template>
  <div class="h-full flex flex-col" style="user-select: text;">
    <TabView v-model:activeIndex="activeTab">
      <TabPanel header="Received Messages">
        <ReceivedMessages />
      </TabPanel>
      <TabPanel header="Settings">
        <Settings />
      </TabPanel>
    </TabView>
  </div>
  <DropToast />
</template>