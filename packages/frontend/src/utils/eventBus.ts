import mitt from "mitt";

import type { DropConnection, DropPayload, DropType } from "@/types";

type Events = {
  "drop:send": {
    payload: DropPayload;
    connection: DropConnection;
    type: DropType;
  };
  "drop:claim": { payload: DropPayload; alias: string };
  "drop:delete": { payload: DropPayload; alias: string };
};

export const eventBus = mitt<Events>();
