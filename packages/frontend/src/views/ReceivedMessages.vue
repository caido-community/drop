<script setup lang="ts">
import Button from "primevue/button";
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import { onMounted, ref } from "vue";

import { useDrop } from "@/plugins/drop";
import { useSDK } from "@/plugins/sdk";
import { ConfigService } from "@/services/configService";
import { type DropPayload, type DropPluginConfig } from "@/types";
import { eventBus } from "@/utils/eventBus";
import { logger } from "@/utils/logger";

const { generateSummary } = useDrop();
const sdk = useSDK();
const localConfig = ref<DropPluginConfig | undefined>(undefined);

sdk.storage.onChange((storage) => {
  localConfig.value = storage as unknown as DropPluginConfig;
  logger.log("[ReceivedMessages] Storage changed", storage);
  loadMessages();
});

const messages = ref<DropPayload[]>([]);
const isLoading = ref(false);
const error = ref("");

const loadMessages = () => {
  try {
    if (localConfig.value) {
      const currentConfig = JSON.parse(
        JSON.stringify(localConfig.value),
      ) as DropPluginConfig;
      logger.log("[loadMessages] Current config:", currentConfig);
      messages.value = currentConfig.messages || [];
    }
  } catch (err) {
    error.value = "Failed to load messages";
    logger.error(err);
  }
};

const onRefresh = () => {
  isLoading.value = true;
  error.value = "";
  try {
    loadMessages();
  } catch (err) {
    error.value = "Failed to refresh messages";
    logger.error(err);
  } finally {
    isLoading.value = false;
  }
};

// Load initial messages
onMounted(() => {
  const config = ConfigService.getConfig();
  localConfig.value = config;

  loadMessages();
});

const onClaim = (message: DropPayload) => {
  logger.log("[onClaim] Processing claim message", message);
  eventBus.emit("drop:claim", {
    payload: message,
    alias: getSenderAlias(message.message_metadata?.from_public_key || ""),
  });
};

const onDelete = async (message: DropPayload) => {
  try {
    if (localConfig.value) {
      const currentConfig = JSON.parse(
        JSON.stringify(localConfig.value),
      ) as DropPluginConfig;
      const updatedMessages = (currentConfig.messages || []).filter(
        (m) => m.id !== message.id,
      );
      currentConfig.messages = updatedMessages;
      await ConfigService.updateConfig({ messages: updatedMessages });
      messages.value = updatedMessages;
    }
  } catch (err) {
    error.value = "Failed to delete message";
    logger.error(err);
  }
};

const onDeleteAll = async () => {
  try {
    if (localConfig.value) {
      await ConfigService.updateConfig({ messages: [] });
      messages.value = [];
    }
  } catch (err) {
    error.value = "Failed to delete all messages";
    logger.error(err);
  }
};

const onClaimAll = () => {
  messages.value.forEach(async (message) => {
    onClaim(message);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
};

const getSenderAlias = (fingerprint: string) => {
  const connection = localConfig.value?.connections.find(
    (conn) => conn.fingerprint === fingerprint,
  );
  return connection?.alias || fingerprint;
};

const getTableData = () => {
  return messages.value.map((message) => ({
    id: message.id,
    sender: getSenderAlias(message.message_metadata?.from_public_key || ""),
    received: new Date(
      message.message_metadata?.created_at || "",
    ).toLocaleString(),
    summary: generateSummary(message),
    message: message,
  }));
};
</script>

<template>
  <Card
    class="h-full"
    :pt="{
      root: { class: 'flex flex-col h-full' },
      body: { class: 'flex-grow flex flex-col p-0' },
      content: { class: 'flex-grow flex flex-col' },
    }"
  >
    <template #title>
      <div class="flex justify-between items-center p-4">
        <span>Received Messages</span>
        <div class="flex gap-2">
          <Button
            icon="fas fa-arrows-rotate"
            class="p-button-text"
            size="small"
            :loading="isLoading"
            @click="onRefresh"
          />
          <Button
            icon="fas fa-check"
            label="Claim All"
            size="small"
            class="p-button-text"
            :disabled="messages.length === 0"
            @click="onClaimAll"
          />
          <Button
            icon="fas fa-trash"
            label="Delete All"
            size="small"
            class="p-button-text p-button-danger"
            :disabled="messages.length === 0"
            @click="onDeleteAll"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div style="height: 100%; display: flex; flex-direction: column">
        <p v-if="error" class="text-red-500 p-3">{{ error }}</p>

        <div
          v-if="messages.length === 0"
          class="flex flex-col items-center justify-center py-12 text-gray-500"
        >
          <i class="fas fa-inbox text-4xl mb-4"></i>
          <p>No messages received yet</p>
        </div>

        <DataTable
          v-else
          :value="getTableData()"
          :loading="isLoading"
          striped-rows
          scrollable
          scroll-height="80vh"
          class="p-datatable-sm"
          responsive-layout="scroll"
          style="flex: 1; overflow: auto; padding: 0"
          :pt="{
            wrapper: { class: 'p-0' },
          }"
        >
          <Column field="sender" header="Sender" sortable />
          <Column field="received" header="Received" sortable />
          <Column field="summary" header="Summary" sortable />
          <Column header="Actions" style="width: 150px">
            <template #body="slotProps">
              <div class="flex gap-2">
                <Button
                  icon="fas fa-check"
                  label="Claim"
                  @click="onClaim(slotProps.data.message)"
                />
                <Button
                  icon="fas fa-trash"
                  class="p-button-danger"
                  @click="onDelete(slotProps.data.message)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </Card>
</template>
