const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ["pending", "done"], default: "pending" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Assignment", assignmentSchema);