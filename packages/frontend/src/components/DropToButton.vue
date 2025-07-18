<template>
  <div v-if="connections.length > 0">
  <Select
    v-model="selectedConnection"
    :options="connections"
    :loading="isLoading"
    option-label="alias"
    placeholder="Drop to..."
    class="w-full"
    :filter="true"
    @change="handleConnectionSelect"
  >
    <template #option="slotProps">
      <div class="flex items-center gap-2">
        <span>{{ slotProps.option.alias || "Unnamed Connection" }}</span>
      </div>
    </template>
  </Select>
</div>
</template>

<script setup lang="ts">
import Select from "primevue/select";
import { onMounted, ref } from "vue";

import { ConfigService } from "@/services/configService";
import { type DropConnection, type DropPluginConfig } from "@/types";
import { logger } from "@/utils/logger";
import { callbacks } from "@/utils/dropTo";

const isLoading = ref(false);
const connections = ref<DropConnection[]>([]);
const selectedConnection = ref<DropConnection | undefined>(undefined);

const loadConnections = (data: DropPluginConfig) => {
  try {
    isLoading.value = true;
    const rawData = data;
    logger.log("raw data form loadConnections", rawData);
    const config = rawData as { connections?: DropConnection[] };
    connections.value = config?.connections || [];
    logger.log("Loaded connections", connections.value);
  } catch (error) {
    logger.error("Failed to load connections:", error);
  } finally {
    isLoading.value = false;
  }
};

const handleConnectionSelect = () => {
  if (selectedConnection.value) {
    const hash = window.location.hash;
    for (const [key, callback] of Object.entries(callbacks)) {
      if (hash.match(new RegExp(key))) {
        callback(ConfigService.getSDK(), selectedConnection.value);
        break;
      }
    }
    selectedConnection.value = undefined;
  }
};

onMounted(() => {
  ConfigService.onConfigChange((data) => {
    logger.log("[DROP] Storage changed for DropToButton", data);
    loadConnections(data);
  });

  // Wait for storage to be initialized before loading connections
  const waitForStorage = async () => {
    let data;
    while (!(data = ConfigService.getConfig())) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    logger.log("[DROP] Storage initialized for DropToButton", data);
    loadConnections(data);
  };
  waitForStorage();
});
</script>
