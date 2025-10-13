import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  prefix: { type: String, required: true, unique: true },
  seq: { type: Number, default: 100000 },
});

export const Counter = mongoose.model("Counter", counterSchema);
