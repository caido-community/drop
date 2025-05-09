import type { Caido } from "@caido/sdk-frontend";
import { inject, type InjectionKey, type Plugin } from "vue";

type CaidoSDK = Caido<any, any>;

const KEY: InjectionKey<CaidoSDK> = Symbol("CaidoSDK");

export const SDKPlugin: Plugin = (app, sdk: CaidoSDK) => {
  app.provide(KEY, sdk);
};

export const useSDK = () => {
  return inject(KEY) as CaidoSDK;
};
