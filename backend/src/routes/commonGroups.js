const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const CommonGroup = require("../models/CommonGroup");
const Group = require("../models/Group");
const Session = require("../models/Session");
const { auth } = require("../middleware/auth");
const roles = require("../middleware/roles");
const { resolveActiveSession } = require("../services/sessionService");
const { syncCommonGroups } = require("../services/commonGroupService");

const router = express.Router();
router.use(auth);

const hex = z.string().trim().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Couleur hex invalide");
const schema = z.object({
  name: z.string().trim().min(1, "Le nom du groupe est requis").max(120),
  color: z.union([hex, z.literal("")]).optional(),
  icon: z.string().trim().max(80).optional(),
});
const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

/** Groupes communs, avec les sessions où chacun est utilisé et son groupe dans la session en cours. */
router.get("/", async (req, res) => {
  try {
    await syncCommonGroups(req.user._id);
    const [items, groups, active] = await Promise.all([
      CommonGroup.find({ createdBy: req.user._id }).sort({ name: 1 }).lean(),
      Group.find({ createdBy: req.user._id }).select("name session courses archivedAt").lean(),
      resolveActiveSession(req.user),
    ]);
    const sessions = await Session.find({ _id: { $in: groups.map((g) => g.session) } }).select("name").lean();
    const sessionName = new Map(sessions.map((s) => [String(s._id), s.name]));
    res.json(
      items.map((c) => {
        const mine = groups.filter((g) => g.name === c.name);
        const current = active && mine.find((g) => String(g.session) === String(active._id) && !g.archivedAt);
        return {
          ...c,
          sessions: mine.map((g) => ({ _id: g.session, name: sessionName.get(String(g.session)) || "", groupId: g._id })),
          activeGroup: current ? { _id: current._id, courses: current.courses } : null,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: "Chargement des groupes impossible", details: error.message });
  }
});

router.post("/", roles("admin", "teacher"), async (req, res) => {
  try {
    const payload = schema.parse(req.body);
    if (await CommonGroup.exists({ createdBy: req.user._id, name: payload.name })) {
      return res.status(409).json({ message: `Le groupe « ${payload.name} » existe déjà.` });
    }
    const item = await CommonGroup.create({ ...payload, createdBy: req.user._id });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: "Groupe invalide", details: error.message });
  }
});

/** Renommer ou changer le style: s'applique au groupe de chaque session (c'est le même groupe). */
router.put("/:id", roles("admin", "teacher"), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Groupe invalide" });
    const payload = schema.partial().parse(req.body);
    const item = await CommonGroup.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!item) return res.status(404).json({ message: "Groupe introuvable" });
    const oldName = item.name;
    if (payload.name && payload.name !== oldName) {
      if (await CommonGroup.exists({ createdBy: req.user._id, name: payload.name })) {
        return res.status(409).json({ message: `Le groupe « ${payload.name} » existe déjà.` });
      }
      item.name = payload.name;
    }
    if (payload.color !== undefined) item.color = payload.color;
    if (payload.icon !== undefined) item.icon = payload.icon;
    await item.save();
    await Group.updateMany(
      { createdBy: req.user._id, name: oldName },
      { $set: { name: item.name, color: item.color, icon: item.icon } }
    );
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: "Mise à jour impossible", details: error.message });
  }
});

/** Un groupe utilisé dans une session ne se supprime pas d'ici (on le retire d'abord de ses sessions). */
router.delete("/:id", roles("admin", "teacher"), async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: "Groupe invalide" });
  const item = await CommonGroup.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!item) return res.status(404).json({ message: "Groupe introuvable" });
  const used = await Group.countDocuments({ createdBy: req.user._id, name: item.name });
  if (used) return res.status(409).json({ message: `« ${item.name} » est utilisé dans ${used} session(s) : retire-le d'abord de ces sessions.` });
  await item.deleteOne();
  res.status(204).send();
});

module.exports = router;
