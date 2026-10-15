const CommonGroup = require("../models/CommonGroup");
const Group = require("../models/Group");

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

module.exports = { syncCommonGroups, ensureCommonGroup };
