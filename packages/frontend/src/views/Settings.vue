<script setup lang="ts">
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import { computed, onMounted, ref } from "vue";

import { useDrop } from "@/plugins/drop";
import { useSDK } from "@/plugins/sdk";
import { ConfigService } from "@/services/configService";
import { defaultStorage, type DropPluginConfig } from "@/types";
import { fetchUserName } from "@/utils/caido";
import { logger } from "@/utils/logger";
const sdk = useSDK();
const { generatePGPKeyPair, addConnection, removeConnection } = useDrop();

const newConnectionShareCode = ref("");
const isGeneratingKey = ref(false);
const keyGenerationError = ref("");
const userAlias = ref("");
const editingConnection = ref<string | undefined>(undefined);
const editedAlias = ref("");
const apiServer = ref("");
const keyserver = ref("");
const showAdvancedOptions = ref(false);

const localConfig = ref<DropPluginConfig>(defaultStorage);
ConfigService.onConfigChange((config: DropPluginConfig) => {
  localConfig.value = config;
});

const encodedAlias = computed(() => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(userAlias.value || "");
  return btoa(String.fromCharCode.apply(null, [...encoded]));
});

const onGenerateKey = async (nocopy: boolean = false) => {
  isGeneratingKey.value = true;
  keyGenerationError.value = "";

  try {
    const keyPair = await generatePGPKeyPair();
    if (!nocopy) {
      copyFingerprint();
      sdk.window.showToast("Share code successfully generated.", {
        variant: "success",
        duration: 2000,
      });
    }
    onAddConnection(undefined, `${keyPair.fingerprint}:${encodedAlias.value}`);
  } catch (error) {
    keyGenerationError.value = "Failed to generate PGP key pair";
    logger.error(error);
    sdk.window.showToast("Failed to generate PGP key pair", {
      variant: "error",
      duration: 2000,
    });
  } finally {
    isGeneratingKey.value = false;
  }
};

const onAddConnection = async (
  event?: ClipboardEvent,
  shareCodeOverride?: string,
) => {
  if (event) {
    const pastedContent = event.clipboardData?.getData("text") || "";
    newConnectionShareCode.value = pastedContent;
  }

  if (shareCodeOverride) {
    newConnectionShareCode.value = shareCodeOverride;
  }

  if (!newConnectionShareCode.value) {
    return;
  }

  const [fingerprint, alias] = newConnectionShareCode.value.split(":");
  if (!fingerprint || !alias) {
    sdk.window.showToast("Invalid share code.", {
      variant: "error",
      duration: 2000,
    });
    return;
  }

  const connections = localConfig.value?.connections;
  logger.log("[DROP] Connections", connections);
  if (connections?.find((c) => c.fingerprint === fingerprint)) {
    newConnectionShareCode.value = "";
    sdk.window.showToast("Friend already added.", {
      variant: "info",
      duration: 2000,
    });
    return;
  }

  try {
    const connectionAlias = alias
      ? new TextDecoder().decode(
          Uint8Array.from(atob(alias), (c) => c.charCodeAt(0)),
        )
      : prompt("Please enter your friend's alias:");
    if (!connectionAlias) {
      return;
    }

    await addConnection(fingerprint, connectionAlias);
    newConnectionShareCode.value = "";
    if (!shareCodeOverride) {
      sdk.window.showToast("Friend added successfully.", {
        variant: "success",
        duration: 2000,
      });
    }
  } catch (error) {
    logger.error("Failed to add connection:", error);
    sdk.window.showToast("Failed to add connection", {
      variant: "error",
      duration: 2000,
    });
  }
};

const onRemoveConnection = async (fingerprint: string) => {
  try {
    await removeConnection(fingerprint);
  } catch (error) {
    logger.error("Failed to remove connection:", error);
  }
};

const copyFingerprint = (e?: Event) => {
  if (e && e.target instanceof HTMLInputElement) {
    e.target.select();
  }

  if (localConfig.value?.pgpKeyPair) {
    const shareCode = `${localConfig.value.pgpKeyPair.fingerprint}:${encodedAlias.value}`;
    navigator.clipboard.writeText(shareCode);
    sdk.window.showToast("Share code copied to clipboard", {
      variant: "success",
      duration: 2000,
    });
  }
};

const updateUserAlias = async () => {
  if (userAlias.value) {
    await ConfigService.updateConfig({ alias: userAlias.value });
  }
};

const onUpdateConnectionAlias = async (fingerprint: string) => {
  if (!editedAlias.value) return;

  try {
    const config = ConfigService.getConfig();
    const connection = config.connections.find(
      (c) => c.fingerprint === fingerprint,
    );
    if (connection) {
      connection.alias = editedAlias.value;
      await ConfigService.updateConfig({
        connections: config.connections,
      });
    }
  } catch (error) {
    logger.error("Failed to update connection alias:", error);
  } finally {
    editingConnection.value = null;
    editedAlias.value = "";
  }
};

const updateServerConfig = async () => {
  try {
    const config = ConfigService.getConfig();
    config.apiServer = apiServer.value;
    config.keyServer = keyserver.value;
    await ConfigService.updateConfig({
      apiServer: apiServer.value,
      keyServer: keyserver.value,
    });

    sdk.window.showToast("Server configuration updated successfully.", {
      variant: "success",
      duration: 2000,
    });
  } catch (error) {
    logger.error("Failed to update server configuration:", error);
    sdk.window.showToast("Failed to update server configuration.", {
      variant: "error",
      duration: 2000,
    });
  }
};

const handleServerConfigChange = () => {
  updateServerConfig();
};

onMounted(async () => {
  const config = ConfigService.getConfig();
  localConfig.value = config;

  logger.log("Settings' Storage", config);

  // Set initial values for servers
  apiServer.value = config.apiServer || "";
  keyserver.value = config.keyServer || "";

  // Set initial alias from config if it exists
  if (config.alias) {
    userAlias.value = config.alias;
  } else {
    const name = await fetchUserName();
    if (name) {
      userAlias.value = name;
      await ConfigService.updateConfig({ alias: name });
    }
  }

  if (!config.pgpKeyPair) {
    onGenerateKey(true);
  }

  if (config.firstOpen) {
    config.firstOpen = false;
    await ConfigService.updateConfig({ firstOpen: false });
  }
});
</script>

<template>
  <div class="p-4">
    <Card class="mb-4">
      <template #title>
        {{
          localConfig.pgpKeyPair
            ? "Your Share Code (PGP Fingerprint)"
            : "Generate Your Share Code (PGP)"
        }}
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div v-if="!localConfig.pgpKeyPair">
            <Button
              :loading="isGeneratingKey"
              label="Generate Share Code"
              @click="onGenerateKey"
            />
            <p v-if="keyGenerationError" class="text-red-500 mt-2">
              {{ keyGenerationError }}
            </p>
          </div>

          <div v-else class="flex flex-col gap-2">
            <div class="flex flex-col gap-2 mb-4">
              <label for="userAlias"
                >Your Alias (shared along with Share Code)</label
              >
              <InputText
                id="userAlias"
                v-model="userAlias"
                placeholder="Enter your alias"
                @change="updateUserAlias"
              />
            </div>
            <p class="font-bold">Your Share Code</p>
            <div class="flex items-center gap-2">
              <Button
                icon="fa-regular fa-copy"
                class="p-button-text"
                @click="copyFingerprint"
              />
              <InputText
                :model-value="`${localConfig.pgpKeyPair.fingerprint}:${encodedAlias}`"
                readonly
                class="font-mono w-full select-none"
                @dblclick="copyFingerprint"
              />
            </div>
          </div>

          <div class="flex flex-col gap-4 mt-4">
            <span
              class="text-primary cursor-pointer hover:underline"
              @click="showAdvancedOptions = !showAdvancedOptions"
            >
              {{
                showAdvancedOptions
                  ? "Hide Advanced Options"
                  : "Show Advanced Options"
              }}
            </span>
            <div v-if="showAdvancedOptions" class="flex flex-col gap-4">
              <p class="text-sm text-gray-100">
                The settings below should only be used if you're hosting your
                own instance of drop. You can find the repository for the drop
                server
                <a
                  href="https://github.com/caido-community/drop/tree/main/packages/server"
                  target="_blank"
                  class="text-primary hover:underline"
                  >here.</a
                >
              </p>
              <div class="flex flex-col gap-2">
                <label for="apiServer">API Server URL</label>
                <InputText
                  id="apiServer"
                  v-model="apiServer"
                  placeholder="Enter API Server URL"
                  @change="handleServerConfigChange"
                  @keyup.enter="handleServerConfigChange"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label for="keyserver">Key Server URL</label>
                <InputText
                  id="keyserver"
                  v-model="keyserver"
                  placeholder="Enter Key Server URL"
                  @change="handleServerConfigChange"
                  @keyup.enter="handleServerConfigChange"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Friends</template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex gap-2">
            <InputText
              v-model="newConnectionShareCode"
              placeholder="Paste share code here to add a new friend."
              class="w-full"
              @paste="onAddConnection"
              @keyup.enter="onAddConnection"
            />
          </div>

          <div
            v-if="localConfig.connections.length > 0"
            class="flex flex-col gap-2"
          >
            <div
              v-for="conn in localConfig.connections"
              :key="conn.fingerprint"
              class="flex items-center justify-between p-3 bg-zinc-800/40 rounded transition-colors"
            >
              <div>
                <div
                  v-if="editingConnection === conn.fingerprint"
                  class="flex gap-2"
                >
                  <InputText
                    v-model="editedAlias"
                    autofocus
                    @keyup.enter="onUpdateConnectionAlias(conn.fingerprint)"
                    @blur="onUpdateConnectionAlias(conn.fingerprint)"
                  />
                </div>
                <div v-else>
                  <p
                    class="font-bold cursor-text cursor-pointer hover:underline"
                    @dblclick="
                      () => {
                        editingConnection = conn.fingerprint;
                        editedAlias = conn.alias;
                      }
                    "
                  >
                    {{ conn.alias }}
                  </p>
                  <p class="text-sm text-gray-500">{{ conn.fingerprint }}</p>
                </div>
              </div>
              <Button
                icon="fas fa-trash"
                class="p-button-danger p-button-text"
                @click="onRemoveConnection(conn.fingerprint)"
              />
            </div>
          </div>
          <p v-else class="text-gray-500">No friends added yet</p>
        </div>
      </template>
    </Card>
  </div>
</template>
