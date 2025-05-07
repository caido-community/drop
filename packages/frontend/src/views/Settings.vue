<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
const sdk = useSDK();
import { ref, onMounted, computed } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Card from "primevue/card";
import { useDrop } from "@/plugins/drop";
import { PGPKeyPair, DropPluginConfig, defaultStorage } from "@/types";
import { logger } from "@/utils/logger";
const { generatePGPKeyPair, addConnection, removeConnection } = useDrop();

const newConnectionShareCode = ref("");
const newConnectionAlias = ref("");
const isGeneratingKey = ref(false);
const keyGenerationError = ref("");
const userAlias = ref("");
const editingConnection = ref<string | null>(null);
const editedAlias = ref("");

const localConfig = ref<DropPluginConfig>(defaultStorage);
sdk.storage.onChange((storage) => {
  localConfig.value = storage;
});

const encodedAlias = computed(() => {
  return btoa(userAlias.value || '');
});

const onGenerateKey = async (nocopy: boolean = false) => {
  isGeneratingKey.value = true;
  keyGenerationError.value = "";

  try {
    const keyPair = await generatePGPKeyPair();
    if (!nocopy) {
      copyFingerprint();
      sdk.window.showToast("Share code successfully generated.", {variant:"success", duration:2000});
    }
    onAddConnection(null, `${keyPair.fingerprint}:${btoa((userAlias.value || ''))}`);
  } catch (error) {
    keyGenerationError.value = "Failed to generate PGP key pair";
    logger.error(error);
  } finally {
    isGeneratingKey.value = false;
  }
};

const onAddConnection = async (event?: ClipboardEvent, shareCodeOverride?: string) => {
  // If event is provided (from paste), get the pasted content
  if (event) {
    const pastedContent = event.clipboardData?.getData('text') || '';
    newConnectionShareCode.value = pastedContent;
  }

  if (shareCodeOverride) {
    newConnectionShareCode.value = shareCodeOverride;
  }

  if (!newConnectionShareCode.value) {
    return;
  }
  const [fingerprint, alias] = newConnectionShareCode.value.split(':');

  const connections = localConfig.value?.connections;
  logger.log("[DROP] Connections", connections);
  if (connections?.find(c => c.fingerprint === fingerprint)) {
    newConnectionShareCode.value = "";
    sdk.window.showToast("Friend already added.", {variant:"info", duration:2000});
    return;
  }

  try {
    const connectionAlias = alias ? atob(alias) : prompt('Please enter your friend\'s alias:');
    if (!connectionAlias) {
      return;
    }
    await addConnection(fingerprint, connectionAlias);
    newConnectionShareCode.value = "";
    if (!shareCodeOverride) {
      sdk.window.showToast("Friend added successfully.", {variant:"success", duration:2000});
    }
  } catch (error) {
    logger.error("Failed to add connection:", error);
  }
};

const onRemoveConnection = async (fingerprint: string) => {
  try {
    await removeConnection(fingerprint);
  } catch (error) {
    logger.error("Failed to remove connection:", error);
  }
};

const copyFingerprint = (e: Event) => {
  if (e.target instanceof HTMLInputElement) {
    e.target.select();
  }
  if (localConfig.value?.pgpKeyPair) {
    const shareCode = `${localConfig.value.pgpKeyPair.fingerprint}:${encodedAlias.value}`;
    navigator.clipboard.writeText(shareCode);
    sdk.window.showToast("Share code copied to clipboard", {variant:"success", duration:2000});
  }
};

const updateUserAlias = async () => {
  if (userAlias.value) {
    const storage = await sdk.storage.get();
    storage.alias = userAlias.value;
    await sdk.storage.set({ ...storage });
  }
};

const fetchUserName = async () => {
  try {
    const auth = JSON.parse(localStorage.getItem('CAIDO_AUTHENTICATION') || '{}');
    const accessToken = auth.accessToken;

    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        query: `query Viewer {
          viewer {
            ...on CloudUser {
              profile {
                identity {
                  name
                }
              }
            }
          }
        }`,
        operationName: 'Viewer'
      })
    });

    const data = await response.json();
    if(!data?.data?.viewer?.profile?.identity?.name){
      logger.log("[DROP] Failed to fetch user name.  Trying legacy endpoint:");
      const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          query: `query Viewer {
            viewer {
              profile {
                identity {
                  name
                }
              }
            }
          }`,
          operationName: 'Viewer'
        })
      });

      const data = await response.json();
      return data?.data?.viewer?.profile?.identity?.name || "Caido User";
    }
    return data?.data?.viewer?.profile?.identity?.name;
  } catch (err) {
    logger.error('Failed to fetch user name:', err);
    return "Caido User";
  }
};

const onUpdateConnectionAlias = async (fingerprint: string) => {
  if (!editedAlias.value) return;
  
  try {
    const storage = await sdk.storage.get();
    const connection = storage.connections.find(c => c.fingerprint === fingerprint);
    if (connection) {
      connection.alias = editedAlias.value;
      await sdk.storage.set({ ...storage });
    }
  } catch (error) {
    logger.error("Failed to update connection alias:", error);
  } finally {
    editingConnection.value = null;
    editedAlias.value = "";
  }
};

onMounted(async () => {
  let storage = await sdk.storage.get();
  localConfig.value = storage;
  logger.log("Settings' Storage", storage);

  // Set initial alias from config if it exists
  if (storage.alias) {
    userAlias.value = storage.alias;
  } else {
      // If no stored alias, fetch from API
    const name = await fetchUserName();
    if (name) {
      userAlias.value = name;
      await sdk.storage.set({ ...storage, alias: name });
    }
  }
  if (!storage.pgpKeyPair) {
    onGenerateKey(true);
  }
  if (storage.firstOpen) {
    storage.firstOpen = false;
    await sdk.storage.set({ ...storage });
  }
});
</script>

<template>
  <div class="p-4">
    <Card class="mb-4">
      <template #title>
        {{ localConfig.pgpKeyPair ? 'Your Share Code (PGP Fingerprint)' : 'Generate Your Share Code (PGP)' }}
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
              <label for="userAlias">Your Alias (shared along with Share Code)</label>
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
            />
          </div>

          <div v-if="localConfig.connections.length > 0" class="flex flex-col gap-2">
            <div
              v-for="conn in localConfig.connections"
              :key="conn.fingerprint"
              class="flex items-center justify-between p-2 border rounded"
            >
              <div>
                <div v-if="editingConnection === conn.fingerprint" class="flex gap-2">
                  <InputText
                    v-model="editedAlias"
                    @keyup.enter="onUpdateConnectionAlias(conn.fingerprint)"
                    @blur="onUpdateConnectionAlias(conn.fingerprint)"
                    autofocus
                  />
                </div>
                <div v-else>
                  <p class="font-bold cursor-pointer" @dblclick="() => { editingConnection = conn.fingerprint; editedAlias = conn.alias; }">{{ conn.alias }}</p>
                  <p class="text-sm text-gray-500">{{ conn.fingerprint }}</p>
                </div>
              </div>
              <Button
                icon="fas fa-trash"
                class="p-button-danger"
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