const CommonGroup = require("../models/CommonGroup");
const Group = require("../models/Group");
const { detachGroup } = require("./sessionCourseService");

/**
 * Les groupes de session créés ailleurs (élèves importés, copie de session, anciennes données) n'ont pas
 * forcément leur groupe commun: on l'ajoute, avec la couleur et l'icône du groupe de session. Idempotent.
 */
async function syncCommonGroups(ownerId) {
  const rows = await Group.aggregate([
    { $match: { createdBy: ownerId } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$name", color: { $first: "$color" }, icon: { $first: "$icon" } } },
  ]);
  if (!rows.length) return;
  await CommonGroup.bulkWrite(
    rows.map((r) => ({
      updateOne: {
        filter: { createdBy: ownerId, name: r._id },
        update: { $setOnInsert: { createdBy: ownerId, name: r._id, color: r.color || "", icon: r.icon || "" } },
        upsert: true,
      },
    }))
  );
}

/** Le groupe commun du nom donné (créé au besoin), pour qu'un groupe ajouté à une session figure dans Ressources. */
async function ensureCommonGroup(ownerId, name, style = {}) {
  return CommonGroup.findOneAndUpdate(
    { createdBy: ownerId, name },
    { $setOnInsert: { createdBy: ownerId, name, color: style.color || "", icon: style.icon || "" } },
    { upsert: true, returnDocument: "after" }
  );
}

/**
 * Après la suppression d'un groupe de session: il sort des cours de ses sessions (ou passe à `into` en cas de
 * fusion) et son groupe commun disparaît s'il n'est plus utilisé nulle part, pour ne plus être proposé.
 */
async function forgetGroup(ownerId, group, into) {
  await detachGroup(group._id, into);
  if (!(await Group.exists({ createdBy: ownerId, name: group.name }))) await CommonGroup.deleteOne({ createdBy: ownerId, name: group.name });
}

/**
 * Au démarrage: un groupe commun que plus aucune session n'utilise (groupe supprimé avant que la suppression
 * le retire aussi d'ici) n'a plus de raison d'être proposé. Idempotent.
 */
async function purgeOrphanCommonGroups() {
  const used = new Set((await Group.aggregate([{ $group: { _id: { u: "$createdBy", n: "$name" } } }])).map((r) => `${r._id.u}|${r._id.n}`));
  const orphans = (await CommonGroup.find().select("createdBy name").lean()).filter((c) => !used.has(`${c.createdBy}|${c.name}`));
  if (orphans.length) await CommonGroup.deleteMany({ _id: { $in: orphans.map((c) => c._id) } });
  return orphans.length;
}

module.exports = { syncCommonGroups, ensureCommonGroup, forgetGroup, purgeOrphanCommonGroups };
