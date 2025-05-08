<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { ref, onMounted } from "vue";
import MenuBar from "primevue/menubar";
import Settings from "./Settings.vue";
import ReceivedMessages from "./ReceivedMessages.vue";
import { useToast } from "primevue/usetoast";
import { useDrop } from "@/plugins/drop";
import DropToast from "@/components/DropToast.vue";
import { logger } from "@/utils/logger";
import Card from "primevue/card";

const sdk = useSDK();
const page = ref("Received Messages");
const toast = useToast();
const { initializeDrop } = useDrop();
logger.log("[App] SDK", sdk);

const items = ref([
  {
    label: "Received Messages",
    command: () => (page.value = "Received Messages"),
  },
  {
    label: "Settings",
    command: () => (page.value = "Settings"),
  },
]);

onMounted(async () => {
  initializeDrop(toast);
  logger.log("[App] Initializing");
  const storage = await sdk.storage.get();
  logger.log("[App] Storage", storage);
  if (storage && typeof storage === "object" && "firstOpen" in storage) {
    page.value = "Settings";
  }
});
</script>

<template>
  <div class="h-full flex flex-col gap-1 select-text">
    <MenuBar breakpoint="320px">
      <template #start>
        <div class="flex">
          <div
            v-for="(item, index) in items"
            :key="index"
            class="px-3 py-2 cursor-pointer text-gray-300 rounded transition-all duration-200 ease-in-out"
            :class="{
              'bg-zinc-800/40': page === item.label,
              'hover:bg-gray-800/10': page !== item.label,
            }"
            @click="item.command"
          >
            {{ item.label }}
          </div>
        </div>
      </template>
    </MenuBar>

    <Card class="h-full" :pt="{ body: { class: 'h-full' }, content: { class: 'h-full' } }">
      <template #content>
        <ReceivedMessages v-if="page === 'Received Messages'" />
        <Settings v-if="page === 'Settings'" />
      </template>
    </Card>
  </div>
  <DropToast />
</template>
