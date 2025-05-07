<script setup lang="ts">
import { ref, onMounted } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import { useDrop} from "@/plugins/drop";
import { DropPayload } from "@/types";
import { useSDK } from "@/plugins/sdk";
import { DropPluginConfig } from "@/types";
import { logger } from "@/utils/logger";

const { generateSummary } = useDrop();
const sdk = useSDK();
const localConfig = ref<DropPluginConfig | null>(null);
sdk.storage.onChange((storage) => {
  localConfig.value = storage;
  logger.log("[ReceivedMessages] Storage changed", storage);
  loadMessages();
});

const messages = ref<DropPayload[]>([]);
const isLoading = ref(false);
const error = ref("");

const loadMessages = async () => {
  try {
    if (localConfig.value) {
      const currentConfig = JSON.parse(JSON.stringify(localConfig.value)) as DropPluginConfig;
      logger.log("[loadMessages] Current config:", currentConfig);
      messages.value = currentConfig.messages || [];
    }
  } catch (err) {
    error.value = "Failed to load messages";
    logger.error(err);
  }
};

const onRefresh = async () => {
  isLoading.value = true;
  error.value = "";
  try {
    await loadMessages();
  } catch (err) {
    error.value = "Failed to refresh messages";
    logger.error(err);
  } finally {
    isLoading.value = false;
  }
};

// Load initial messages
onMounted(async () => {
  let storage = await sdk.storage.get();
  localConfig.value = storage;
  await loadMessages();
});

const onClaim = async (message: DropPayload) => {
  logger.log("[onClaim] Processing claim message", message);
  const event = new CustomEvent('drop:claim', { detail: { payload:message, alias:getSenderAlias(message.message_metadata?.from_public_key) } });
  document.dispatchEvent(event);
};

const onDelete = async (message: DropPayload) => {
  try {
    if (localConfig.value) {
      const currentConfig = JSON.parse(JSON.stringify(localConfig.value)) as DropPluginConfig;
      const updatedMessages = (currentConfig.messages || []).filter(m => m.id !== message.id);
      currentConfig.messages = updatedMessages;
      await sdk.storage.set(currentConfig);
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
      const currentConfig = JSON.parse(JSON.stringify(localConfig.value)) as DropPluginConfig;
      currentConfig.messages = [];
      await sdk.storage.set(currentConfig);
      messages.value = [];
    }
  } catch (err) {
    error.value = "Failed to delete all messages";
    logger.error(err);
  }
};

const onClaimAll = async () => {
  messages.value.forEach(async (message) => {
    await onClaim(message);
    await new Promise(resolve => setTimeout(resolve, 500));
  });
};

const getSenderAlias = (fingerprint: string) => {
  const connection = localConfig.value?.connections.find(
    (conn) => conn.fingerprint === fingerprint
  );
  return connection?.alias || fingerprint;
};

const getTableData = () => {
  return messages.value.map(message => ({
    id: message.id,
    sender: getSenderAlias(message.message_metadata?.from_public_key),
    received: new Date(message.message_metadata?.created_at).toLocaleString(),
    summary: generateSummary(message),
    message: message
  }));
};
</script>

<template>
  <div class="p-4">
    <Card>
      <template #title>
        <div class="flex justify-between items-center">
          <span>Received Messages</span>
          <div class="flex gap-2">
            <Button
              icon="fas fa-arrows-rotate"
              class="p-button-text"
              :loading="isLoading"
              @click="onRefresh"
            />
            <Button
              icon="fas fa-check"
              label="Claim All"
              class="p-button-text"
              @click="onClaimAll"
              :disabled="messages.length === 0"
            />
            <Button
              icon="fas fa-trash"
              label="Delete All"
              class="p-button-text p-button-danger"
              :disabled="messages.length === 0"
              @click="onDeleteAll"
            />
          </div>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <p v-if="error" class="text-red-500">{{ error }}</p>

          <div v-if="messages.length === 0" class="text-gray-500">
            No messages received yet
          </div>

          <DataTable
            v-else
            :value="getTableData()"
            :loading="isLoading"
            class="p-datatable-sm"
            responsiveLayout="scroll"
          >
            <Column field="sender" header="Sender" sortable />
            <Column field="received" header="Received" sortable />
            <Column field="summary" header="Summary" sortable />
            <Column header="Actions">
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
  </div>
</template>