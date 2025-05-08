<template>
  <Select
    v-model="selectedConnection"
    :options="connections"
    :loading="isLoading"
    optionLabel="alias"
    placeholder="Drop to..."
    class="w-full"
    @change="handleConnectionSelect"
    :filter="true"
  >
    <template #option="slotProps">
      <div class="flex items-center gap-2">
        <span>{{ slotProps.option.alias || "Unnamed Connection" }}</span>
      </div>
    </template>
  </Select>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Select from "primevue/select";
import { DropConnection, FrontendSDK } from "@/types";
import { logger } from "@/utils/logger";

const props = defineProps<{
  sdk: FrontendSDK;
  title: string;
  onConnectionSelect: (connection: DropConnection) => void;
}>();

const isLoading = ref(false);
const connections = ref<DropConnection[]>([]);
const selectedConnection = ref<DropConnection | null>(null);

const loadConnections = async (data: any) => {
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
    props.onConnectionSelect(selectedConnection.value);
    selectedConnection.value = null;
  }
};

onMounted(() => {
  props.sdk.storage.onChange((data) => {
    logger.log("[DROP] Storage changed for " + props.title, data);
    loadConnections(data);
  });

  // Wait for storage to be initialized before loading connections
  const waitForStorage = async () => {
    let data;
    while (!(data = await props.sdk.storage.get())) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    logger.log("[DROP] Storage initialized for " + props.title, data);
    loadConnections(data);
  };
  waitForStorage();
});
</script>
