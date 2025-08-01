<script setup lang="ts">
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import FileUpload from "primevue/fileupload";
import { computed, onMounted, ref } from "vue";
import { readKey, readPrivateKey } from "openpgp";

import { DropAPI } from "@/api/dropService";
import { useDrop } from "@/plugins/drop";
import { useSDK } from "@/plugins/sdk";
import { ConfigService } from "@/services/configService";
import {
  defaultStorage,
  type DropPluginConfig,
  type PGPKeyPair,
} from "@/types";
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
const isImportingKey = ref(false);
const importError = ref("");
const fileUploadRef = ref();

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
  // If user already has a key pair, ask for confirmation before regenerating
  if (localConfig.value?.pgpKeyPair && !nocopy) {
    const confirmed = confirm(
      "Are you sure you want to regenerate your PGP key pair? This will replace your current keys and you'll need to share your new share code with friends again.",
    );
    if (!confirmed) {
      return;
    }
  }

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
  if (!fingerprint) {
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
    editingConnection.value = undefined;
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

const onExportKey = () => {
  if (!localConfig.value?.pgpKeyPair) {
    sdk.window.showToast("No PGP key pair to export", {
      variant: "error",
      duration: 2000,
    });
    return;
  }

  const keyData = {
    publicKey: localConfig.value.pgpKeyPair.publicKey,
    privateKey: localConfig.value.pgpKeyPair.privateKey,
    fingerprint: localConfig.value.pgpKeyPair.fingerprint,
    alias: localConfig.value.alias || userAlias.value,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(keyData, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `caido-drop-keys-${keyData.fingerprint.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  sdk.window.showToast("PGP keys exported successfully", {
    variant: "success",
    duration: 2000,
  });
};

const onImportKey = async (event: any) => {
  isImportingKey.value = true;
  importError.value = "";

  try {
    const file = event.files[0];
    if (!file) {
      throw new Error("No file selected");
    }

    const text = await file.text();
    const keyData = JSON.parse(text);

    // Validate the imported data structure
    if (!keyData.publicKey || !keyData.privateKey || !keyData.fingerprint) {
      throw new Error("Invalid key file format");
    }

    // Validate the PGP keys
    const publicKey = await readKey({ armoredKey: keyData.publicKey });
    const privateKey = await readPrivateKey({ armoredKey: keyData.privateKey });

    // Verify fingerprint matches
    const calculatedFingerprint = publicKey.getFingerprint().toUpperCase();
    if (calculatedFingerprint !== keyData.fingerprint.toUpperCase()) {
      throw new Error("Fingerprint mismatch");
    }

    const importedKeyPair: PGPKeyPair = {
      publicKey: keyData.publicKey,
      privateKey: keyData.privateKey,
      fingerprint: calculatedFingerprint,
    };

    // Upload the public key to the keyserver
    await DropAPI.uploadKey(keyData.publicKey);

    // Update the config with the imported key pair
    const config = ConfigService.getConfig();
    config.pgpKeyPair = importedKeyPair;

    // Update alias if provided in the key file
    if (keyData.alias && keyData.alias !== config.alias) {
      config.alias = keyData.alias;
      userAlias.value = keyData.alias;
    }

    await ConfigService.updateConfig(config);

    sdk.window.showToast("PGP keys imported successfully", {
      variant: "success",
      duration: 2000,
    });

    // Clear the file upload
    fileUploadRef.value?.clear();
  } catch (error) {
    logger.error("Failed to import PGP key:", error);
    importError.value =
      error instanceof Error ? error.message : "Failed to import PGP key";
    sdk.window.showToast("Failed to import PGP key", {
      variant: "error",
      duration: 3000,
    });
  } finally {
    isImportingKey.value = false;
  }
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
              <Button
                icon="fas fa-refresh"
                class="p-button-outlined"
                label="Regenerate"
                :loading="isGeneratingKey"
                @click="onGenerateKey"
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
              <!-- PGP Key Management Section -->
              <div class="flex flex-col gap-4">
                <h4 class="font-bold text-lg">PGP Key Management</h4>

                <!-- Export Key -->
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium"
                    >Export PGP Keys -
                    <span class="text-sm text-gray-400"
                      >Download your PGP key pair as a backup file</span
                    >
                  </label>
                  <div class="flex items-center gap-2">
                    <Button
                      icon="fas fa-download"
                      label="Export Keys"
                      class="p-button-outlined"
                      @click="onExportKey"
                    />
                  </div>
                </div>

                <!-- Import Key -->
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium"
                    >Import PGP Keys -
                    <span class="text-sm text-gray-400"
                      >Import a previously exported PGP key pair file</span
                    >
                  </label>
                  <FileUpload
                    ref="fileUploadRef"
                    mode="basic"
                    accept=".json"
                    :multiple="false"
                    :auto="true"
                    choose-label="Import Keys"
                    :loading="isImportingKey"
                    @select="onImportKey"
                    class="import-file-upload"
                    :pt="{
                      root: { class: '!justify-start' },
                    }"
                  />
                  <p v-if="importError" class="text-red-500 text-sm mt-1">
                    {{ importError }}
                  </p>
                </div>
              </div>

              <!-- Custom Server Configuration Section -->
              <div
                class="flex flex-col gap-4 mt-6 pt-4 border-t border-zinc-700"
              >
                <h4 class="font-bold text-lg">Custom Server Configuration</h4>
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
                  <div class="flex items-center gap-2">
                    <InputText
                      id="apiServer"
                      v-model="apiServer"
                      class="w-full"
                      placeholder="Enter API Server URL"
                      @change="handleServerConfigChange"
                      @keyup.enter="handleServerConfigChange"
                    />
                    <Button
                      icon="fas fa-undo"
                      class="p-button-text"
                      @click="
                        () => {
                          apiServer = 'https://drop.cai.do';
                          handleServerConfigChange();
                        }
                      "
                    />
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <label for="keyserver">Key Server URL</label>
                  <div class="flex items-center gap-2">
                    <InputText
                      id="keyserver"
                      v-model="keyserver"
                      class="w-full"
                      placeholder="Enter Key Server URL"
                      @change="handleServerConfigChange"
                      @keyup.enter="handleServerConfigChange"
                    />
                    <Button
                      icon="fas fa-undo"
                      class="p-button-text"
                      @click="
                        () => {
                          keyserver = 'https://keys.openpgp.org/';
                          handleServerConfigChange();
                        }
                      "
                    />
                  </div>
                </div>
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

<style scoped>
:deep(.import-file-upload[data-pc-name="fileupload"]) {
  justify-content: flex-start !important;
}

:deep(.import-file-upload .p-fileupload-choose) {
  @apply bg-transparent border border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-500;
}

:deep(.import-file-upload .p-fileupload-choose:focus) {
  @apply ring-2 ring-blue-500 ring-opacity-50;
}
</style>
