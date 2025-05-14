<template>
  <Toast
    position="top-right"
    :pt="{
      root: { class: 'min-w-[750px] !z-[9999]' },
    }"
  >
    <template #message="slotProps">
      <div class="flex flex-row w-full justify-between items-center">
        <span class="text-sm">
          <i class="fas fa-droplet pr-2"></i>
          <span class="pr-1 font-bold">
            from {{ truncateText(slotProps.message.data?.name, 20) }} |
          </span>
          <span class="text-sm pr-4">
            {{ truncateText(slotProps.message.data?.description, 60) }}
          </span>
        </span>
        <ButtonGroup class="flex items-center">
          <Button
            label="Claim"
            icon="fas fa-plus"
            outlined
            rounded
            size="small"
            class="flex-1 transition-colors border-gray-500"
            severity="primary"
            @click="slotProps.message.data?.claim"
          />
          <Button
            label="Delete"
            icon="fas fa-trash"
            outlined
            rounded
            size="small"
            class="flex-1 hover:bg-red-500/10 transition-colors"
            severity="danger"
            @click="slotProps.message.data?.delete"
          />
        </ButtonGroup>
      </div>
      <div class="h-8 w-[1px] bg-gray-500 mx-4"></div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Button from "primevue/button";
import ButtonGroup from "primevue/buttongroup";
import Toast from "primevue/toast";

const truncateText = (text: string | undefined, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};
</script>
