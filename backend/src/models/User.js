const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "teacher"], default: "teacher" },
    /** Session sur laquelle l'utilisateur travaille (une seule à la fois); absente = la plus pertinente selon les dates. */
    activeSession: { type: mongoose.Schema.Types.ObjectId, ref: "Session", default: null },
    /** Date à laquelle les anciennes données (groupes en texte) ont été converties en groupes et inscriptions. */
    groupsMigratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
