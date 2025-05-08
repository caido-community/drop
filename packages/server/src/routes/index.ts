import { Router } from "express";
import send from "./send";
import poll from "./poll";
import health from "./health";

const router = Router();

router.post("/api/v1/send", send);
router.post("/api/v1/poll", poll);
router.get("/health", health);

export default router;
