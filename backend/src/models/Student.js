const mongoose = require("mongoose");

const { splitFullName, buildFullName } = require("../utils/studentName");

const studentSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    /** Nom complet dénormalisé (Prénom + nom), conservé pour recherche et données existantes */
    name: { type: String, required: true, trim: true },
    email: { type: String },
    group: { type: String }, // optional group/class name
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

studentSchema.pre("validate", function studentNameSync() {
  const fn = String(this.firstName || "").trim();
  const ln = String(this.lastName || "").trim();
  const legacy = String(this.name || "").trim();
  if (fn || ln) {
    this.firstName = fn;
    this.lastName = ln;
    this.name = buildFullName(fn, ln) || legacy;
  } else if (legacy) {
    const sp = splitFullName(legacy);
    this.firstName = sp.firstName;
    this.lastName = sp.lastName;
    this.name = legacy;
  }
  if (!String(this.name || "").trim()) {
    this.invalidate("name", "Nom requis");
  }
});

module.exports = mongoose.model("Student", studentSchema);
