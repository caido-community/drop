<template>
  <Toast
    position="top-right"
    :pt="{
      root: { class: 'min-w-[750px] !z-[9999]' },
    }"
  >
    <template #message="slotProps" class="select-text">
      <div class="flex flex-row w-full justify-between items-center">
        <span class="text-sm">
          <i class="fas fa-droplet pr-2"></i
          ><span class="pr-1 font-bold"
            >from {{ slotProps.message.data.name.slice(0, 20)
            }}{{ slotProps.message.data.name.length > 20 ? "..." : "" }} |</span
          >
          <span class="text-sm pr-4"
            >{{ slotProps.message.data.description.slice(0, 60)
            }}{{
              slotProps.message.data.description.length > 60 ? "..." : ""
            }}</span
          >
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
            @click="slotProps.message.data.claim"
          />
          <Button
            label="Delete"
            icon="fas fa-trash"
            outlined
            rounded
            size="small"
            class="flex-1 hover:bg-red-500/10 transition-colors"
            severity="danger"
            @click="slotProps.message.data.delete"
          />
        </ButtonGroup>
      </div>
      <div class="h-8 w-[1px] bg-gray-500 mx-4"></div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Toast from "primevue/toast";
import Button from "primevue/button";
import ButtonGroup from "primevue/buttongroup";
</script>
