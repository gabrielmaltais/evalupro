const express = require("express");
const { z } = require("zod");
const Group = require("../models/Group");
const { auth } = require("../middleware/auth");
const { resolveActiveSession } = require("../services/sessionService");

const router = express.Router();
router.use(auth);

const hex = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Couleur hex invalide");

const upsertSchema = z.object({
  color: z.union([hex, z.literal("")]).optional(),
  icon: z.string().trim().max(80).optional(),
});

const toStyle = (g) => ({ _id: g._id, groupKey: g.name, color: g.color || "", icon: g.icon || "" });

/** Couleur et icône sont portées par le groupe; cette route les expose par nom de groupe (session active). */
async function activeGroup(req, groupKey) {
  const session = await resolveActiveSession(req.user);
  if (!session) return null;
  return Group.findOne({ createdBy: req.user._id, session: session._id, name: groupKey });
}

router.get("/", async (req, res) => {
  const session = await resolveActiveSession(req.user);
  if (!session) return res.json([]);
  const groups = await Group.find({ createdBy: req.user._id, session: session._id }).sort({ name: 1 }).lean();
  res.json(groups.filter((g) => g.color || g.icon).map(toStyle));
});

router.put("/:groupKey", async (req, res) => {
  try {
    const groupKey = decodeURIComponent(req.params.groupKey).trim();
    if (!groupKey) return res.status(400).json({ message: "Nom de groupe requis" });
    const body = upsertSchema.parse(req.body || {});
    const group = await activeGroup(req, groupKey);
    if (!group) return res.status(404).json({ message: "Groupe introuvable dans la session active" });
    if (body.color === undefined && body.icon === undefined) return res.json(toStyle(group));
    if (body.color !== undefined) group.color = String(body.color || "").trim();
    if (body.icon !== undefined) group.icon = String(body.icon || "").trim();
    await group.save();
    res.json(toStyle(group));
  } catch (error) {
    res.status(400).json({ message: "Style de groupe invalide", details: error.message });
  }
});

router.delete("/:groupKey", async (req, res) => {
  const groupKey = decodeURIComponent(req.params.groupKey).trim();
  const group = await activeGroup(req, groupKey);
  if (group) {
    group.color = "";
    group.icon = "";
    await group.save();
  }
  res.status(204).send();
});

module.exports = router;
