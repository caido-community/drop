import { Router } from "express";

import health from "./health";
import poll from "./poll";
import send from "./send";

const router = Router();

router.post("/api/v1/send", send);
router.post("/api/v1/poll", poll);
router.get("/health", health);

export default router;
