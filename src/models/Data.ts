import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface DataDocument extends Document {
  _id: Types.ObjectId;
  slNo: string;
  profileId: string;
  data: string;
  dataType: string;
  verified: string;
  mobile: string;
  status: string;
  name: string;
  remarkFirst: string;
  refferenceNumber: string;
  refferenceName: string;
  remarkSecond: string;
  assignedStaff: Types.ObjectId;
  isDeleted: boolean;
  reminderDateAndTime?: Date;
  callClickTime?: Date;
  whatsappClickTime?: Date;
  refferenceCallClickTime?: Date;
  refferenceWhatsappClickTime?: Date;
  preferCountry: string[];
  preferJobs: string[];
  job: string;
  searchedHouses: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  religion: string;
  education: string;
  jobType: string;
  monthlyIncome: string;
  spokenLanguage: string[];
  district: string;
  city: string;
  expectations: string;
  createProfileFor: string;
  contactPersonName: string;
  houseType?: string;
  priceRange?: string;
  prefferedPlace?: string;
  caste?: string;
  typeOfJathakam?: string;
  star?: string;
  prefferedSalary?: string;
  visaType?: string;
  prefferedCourse?: string;
  regPayment?: string;
  visaPay?: string;
  regReceived?: string;
  payReceived?: string;
  regBalance?: string;
  payBalance?: string;
  passportNo?: string;
  aadharId?: string;
  vSampleSend?: string;
  processing?: string;
  visaDate?: string;
  step?: number;
  profilePhoto?: string;
  whatsapp?: string;
}

const DataSchema = new Schema<DataDocument>(
  {
    slNo: { type: String, required: true },
    profileId: { type: String},
    dataType: { type: String},
    data: { type: String },
    verified: { type: String },
    mobile: { type: String, required: true },
    name: { type: String },
    remarkFirst: { type: String },
    status: { type: String },
    refferenceNumber: { type: String },
    whatsapp: { type: String },
    refferenceName: { type: String },
    remarkSecond: { type: String },
    assignedStaff: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    reminderDateAndTime: { type: Date },
    callClickTime: { type: Date },
    whatsappClickTime: { type: Date },
    refferenceCallClickTime: { type: Date },
    refferenceWhatsappClickTime: { type: Date },
    preferCountry: { type: [String], default: [] },
    preferJobs: { type: [String], default: [] },
    job: { type: String },
    searchedHouses: { type: String },
    gender: { type: String },
    dateOfBirth: { type: String },
    maritalStatus: { type: String },
    religion: { type: String },
    education: { type: String },
    jobType: { type: String },
    monthlyIncome: { type: String },
    spokenLanguage: { type: [String], default: [] },
    district: { type: String },
    city: { type: String },
    expectations: { type: String },
    createProfileFor: { type: String },
    contactPersonName: { type: String },
    houseType: { type: String },
    priceRange: { type: String },
    prefferedPlace: { type: String },
    caste: { type: String },
    prefferedSalary: { type: String },
    visaType: { type: String },
    prefferedCourse: { type: String },
    regPayment: { type: String },
    visaPay: { type: String },
    regReceived: { type: String },
    payReceived: { type: String },
    regBalance: { type: String },
    payBalance: { type: String },
    passportNo: { type: String },
    aadharId: { type: String },
    vSampleSend: { type: String },
    processing: { type: String },
    visaDate: { type: String },
    profilePhoto: { type: String },
  },
  { timestamps: true }
);

DataSchema.index({ mobile: 1 }, { unique: true });
DataSchema.index({ slNo: 1 }, { unique: true });
DataSchema.index({ profileId: 1 }, { unique: true });

export const Data: Model<DataDocument> =
  mongoose.models.Data || mongoose.model<DataDocument>("Data", DataSchema);
